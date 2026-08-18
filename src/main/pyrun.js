const { spawn, execFile } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

// Runs a Python snippet from a chat message and collects its text output plus any
// matplotlib figures. This executes real code on the user's machine, so it is never
// automatic — the renderer requires an explicit click, and risky code is flagged first.

let cachedPython = null;

function findPython() {
  if (cachedPython) return Promise.resolve(cachedPython);
  const candidates = process.platform === 'win32'
    ? ['python', 'py', 'python3']
    : ['python3', 'python'];
  return new Promise((resolve) => {
    const tryNext = (i) => {
      if (i >= candidates.length) return resolve(null);
      execFile(candidates[i], ['-c', 'import sys; print(sys.version.split()[0]); print(sys.executable)'],
        { timeout: 15000 }, (err, stdout) => {
          if (err) return tryNext(i + 1);
          const [version, exe] = String(stdout).trim().split(/\r?\n/);
          cachedPython = { cmd: candidates[i], version, exe };
          resolve(cachedPython);
        });
    };
    tryNext(0);
  });
}

function packageStatus(py, names) {
  return new Promise((resolve) => {
    const code = `import importlib,json
out={}
for m in ${JSON.stringify(names)}:
    try:
        mod=importlib.import_module(m); out[m]=getattr(mod,'__version__','yes')
    except Exception: out[m]=None
print(json.dumps(out))`;
    execFile(py.cmd, ['-c', code], { timeout: 25000 }, (err, stdout) => {
      if (err) return resolve({});
      try { resolve(JSON.parse(String(stdout).trim())); } catch { resolve({}); }
    });
  });
}

async function info() {
  const py = await findPython();
  if (!py) return { found: false };
  const packages = await packageStatus(py, ['matplotlib', 'numpy', 'pandas', 'seaborn']);
  return { found: true, version: py.version, exe: py.exe, packages };
}

function installPackages(names, onOutput) {
  return new Promise(async (resolve) => {
    const py = await findPython();
    if (!py) return resolve({ error: 'Python was not found on this PC.' });
    const proc = spawn(py.cmd, ['-m', 'pip', 'install', '--upgrade', ...names], { windowsHide: true });
    let log = '';
    const onData = (b) => { const s = b.toString(); log += s; if (onOutput) onOutput(s.slice(-200)); };
    proc.stdout.on('data', onData);
    proc.stderr.on('data', onData);
    proc.on('error', (e) => resolve({ error: e.message }));
    proc.on('exit', (code) => {
      cachedPython = cachedPython; // package set changed; callers re-query info()
      resolve(code === 0 ? { ok: true } : { error: (log.split('\n').filter(Boolean).pop() || 'pip failed') });
    });
  });
}

// Things worth a second look before running model-written code.
const RISKY = [
  [/\bimport\s+(os|sys|subprocess|shutil|socket|ctypes|winreg|glob)\b|\bfrom\s+(os|subprocess|shutil|socket|ctypes|winreg)\s+import/, 'accesses the system (os/subprocess/…)'],
  [/\bopen\s*\([^)]*,\s*['"][wax]/, 'writes or appends to files'],
  [/\b(eval|exec|__import__|compile)\s*\(/, 'executes code built at runtime'],
  [/\bimportlib\b/, 'loads modules by name at runtime'],
  [/\.(write_text|write_bytes|unlink)\s*\(/, 'writes or deletes files through pathlib'],
  [/\bpickle\s*\.\s*(load|loads)\s*\(/, 'unpickles data, which can run code'],
  [/\b(requests|urllib|httpx|aiohttp|ftplib|smtplib)\b/, 'uses the network'],
  [/\b(rmtree|remove|unlink|rmdir|truncate)\s*\(/, 'deletes or truncates files'],
  [/\b(input|getpass)\s*\(/, 'waits for keyboard input (would hang)'],
];

function scan(code) {
  const found = [];
  for (const [re, label] of RISKY) if (re.test(code)) found.push(label);
  return found;
}

const RUNNER = `import sys, os, json, io, traceback
out_dir = sys.argv[1]
code_path = sys.argv[2]
figures = []
have_mpl = False
try:
    import matplotlib
    matplotlib.use("Agg")           # render to file, never open a window
    import matplotlib.pyplot as plt
    plt.show = lambda *a, **k: None  # plt.show() must not block

    # House style. matplotlib's defaults date from its MATLAB-imitating days and
    # are the main reason generated charts look dated: a full box frame, tick
    # marks on all four sides, ten saturated primaries, cramped margins. These are
    # only DEFAULTS — anything the code sets explicitly, or any style it selects,
    # still wins.
    plt.rcParams.update({
        # type: a humanist sans if the machine has one, never the 2003 fallback
        "font.family": "sans-serif",
        "font.sans-serif": ["Segoe UI", "Inter", "Helvetica Neue", "Arial", "DejaVu Sans"],
        "font.size": 10.5,
        "axes.titlesize": 13,
        "axes.titleweight": "bold",
        "axes.titlelocation": "left",   # a headline above the plot, not a caption
        "axes.titlepad": 14,
        "axes.labelsize": 10,
        "axes.labelcolor": "#55534e",
        "xtick.labelsize": 9.5,
        "ytick.labelsize": 9.5,

        # remove: the frame and tick marks carry no information
        "axes.spines.top": False,
        "axes.spines.right": False,
        "axes.edgecolor": "#c9c6bf",
        "axes.linewidth": 0.9,
        "xtick.color": "#55534e",
        "ytick.color": "#55534e",
        "xtick.major.size": 0,
        "ytick.major.size": 0,
        "xtick.minor.size": 0,
        "ytick.minor.size": 0,

        # a faint horizontal rule is enough to read values against
        "axes.grid": True,
        "axes.grid.axis": "y",
        "grid.color": "#e5e2da",
        "grid.linewidth": 0.8,
        "axes.axisbelow": True,        # data in front of the grid, never behind

        # colour that means something: a small muted set, not ten primaries
        "axes.prop_cycle": plt.cycler(color=[
            "#d97757", "#5f8d7e", "#6b8cba", "#c9a227",
            "#8b6f9e", "#7a7a72", "#b0553a", "#3f6b5c",
        ]),
        "lines.linewidth": 2.0,
        "lines.solid_capstyle": "round",
        "patch.edgecolor": "none",

        # room to breathe, and a legend that doesn't box itself in
        "figure.figsize": (7.2, 4.4),
        "figure.dpi": 110,
        "figure.facecolor": "white",
        "axes.facecolor": "white",
        "savefig.facecolor": "white",
        "legend.frameon": False,
        "legend.fontsize": 9.5,
    })
    # Models are trained on years of pre-3.6 examples and still write
    # plt.style.use("seaborn-whitegrid"), a name matplotlib removed in 3.6 (it is
    # "seaborn-v0_8-whitegrid" now). That raises and kills the whole snippet. Repair
    # the old names, and treat a genuinely unknown style as a warning rather than a
    # crash — a chart that renders in the house style beats a traceback.
    _style_use = plt.style.use
    def _forgiving_style_use(style, *args, **kwargs):
        many = isinstance(style, (list, tuple))
        names = list(style) if many else [style]
        fixed = []
        for n in names:
            if isinstance(n, str) and n.startswith("seaborn") and not n.startswith("seaborn-v0_8"):
                renamed = n.replace("seaborn", "seaborn-v0_8", 1)
                if renamed in plt.style.available:
                    n = renamed
            fixed.append(n)
        try:
            return _style_use(fixed if many else fixed[0], *args, **kwargs)
        except Exception:
            sys.stderr.write("[portico] style %r is not available in matplotlib %s; "
                             "keeping the default look\\n" % (style, matplotlib.__version__))
            return None
    plt.style.use = _forgiving_style_use

    have_mpl = True
except Exception:
    pass

src = io.open(code_path, encoding="utf-8").read()
status = 0
try:
    exec(compile(src, "chat_snippet.py", "exec"), {"__name__": "__main__"})
except SystemExit:
    pass
except BaseException:
    traceback.print_exc()
    status = 1

if have_mpl:
    try:
        import matplotlib.pyplot as plt
        for i, num in enumerate(plt.get_fignums()):
            p = os.path.join(out_dir, "figure_%d.png" % (i + 1))
            plt.figure(num).savefig(p, dpi=130, bbox_inches="tight")
            figures.append(p)
    except Exception:
        pass

sys.stdout.flush()
sys.stderr.write("\\n__PORTICO_FIGS__" + json.dumps(figures) + "\\n")
sys.exit(status)
`;

let running = null;

async function run(code, opts = {}) {
  const py = await findPython();
  if (!py) return { error: 'Python was not found on this PC. Install Python 3 and try again.' };

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'portico-py-'));
  const codePath = path.join(dir, 'snippet.py');
  const runnerPath = path.join(dir, '_runner.py');
  fs.writeFileSync(codePath, String(code), 'utf8');
  fs.writeFileSync(runnerPath, RUNNER, 'utf8');

  const timeout = Math.min(Math.max(opts.timeout || 60000, 5000), 300000);
  return new Promise((resolve) => {
    const proc = spawn(py.cmd, [runnerPath, dir, codePath], { cwd: dir, windowsHide: true });
    running = proc;
    let stdout = '';
    let stderr = '';
    let killed = false;
    const timer = setTimeout(() => { killed = true; try { proc.kill(); } catch {} }, timeout);

    proc.stdout.on('data', (b) => { stdout += b.toString(); if (stdout.length > 200000) stdout = stdout.slice(-100000); });
    proc.stderr.on('data', (b) => { stderr += b.toString(); if (stderr.length > 200000) stderr = stderr.slice(-100000); });
    proc.on('error', (e) => { clearTimeout(timer); running = null; resolve({ error: e.message }); });
    proc.on('exit', (exitCode) => {
      clearTimeout(timer);
      running = null;
      let figures = [];
      const m = stderr.match(/__PORTICO_FIGS__(.*)/);
      if (m) {
        try { figures = JSON.parse(m[1]); } catch {}
        stderr = stderr.replace(/\n?__PORTICO_FIGS__.*\n?/, '');
      }
      // routine matplotlib chatter is not an error and shouldn't be shown in red
      stderr = stderr
        .split('\n')
        .filter((l) => !/building the font cache|Matplotlib created a temporary/i.test(l))
        .join('\n');
      resolve({
        ok: exitCode === 0 && !killed,
        timedOut: killed,
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        figures: figures.filter((f) => { try { return fs.existsSync(f); } catch { return false; } }),
        dir,
      });
    });
  });
}

function cancel() {
  if (running) { try { running.kill(); } catch {} running = null; return true; }
  return false;
}

module.exports = { info, installPackages, run, cancel, scan };
