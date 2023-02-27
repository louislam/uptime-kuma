using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Linq;
using System.Net;
using System.Net.Sockets;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Threading;
using System.Threading.Tasks;
using System.Windows.Forms;
using Microsoft.Win32;
using Newtonsoft.Json;
using UptimeKuma.Properties;

namespace UptimeKuma {
    static class Program {
        /// <summary>
        /// The main entry point for the application.
        /// </summary>
        [STAThread]
        static void Main(string[] args) {
            var cwd = Path.GetDirectoryName(Application.ExecutablePath);

            if (cwd != null) {
                Environment.CurrentDirectory = cwd;
            }

            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            Application.Run(new UptimeKumaApplicationContext());
        }
    }

    public class UptimeKumaApplicationContext : ApplicationContext
    {
        private static Mutex mutex = null;

        const string appName = "Uptime Kuma";

        private NotifyIcon trayIcon;
        private Process process;

        private MenuItem statusMenuItem;
        private MenuItem runWhenStarts;
        private MenuItem openMenuItem;

        private RegistryKey registryKey = Registry.CurrentUser.OpenSubKey("SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run", true);


        public UptimeKumaApplicationContext() {

            // Single instance only
            bool createdNew;
            mutex = new Mutex(true, appName, out createdNew);
            if (!createdNew) {
                return;
            }

            var startingText = "Starting server...";
            trayIcon = new NotifyIcon();
            trayIcon.Text = startingText;

            runWhenStarts = new MenuItem("Run when system starts", RunWhenStarts);
            runWhenStarts.Checked = registryKey.GetValue(appName) != null;

            statusMenuItem = new MenuItem(startingText);
            statusMenuItem.Enabled = false;

            openMenuItem = new MenuItem("Open", Open);
            openMenuItem.Enabled = false;

            trayIcon.Icon = Icon.ExtractAssociatedIcon(Assembly.GetExecutingAssembly().Location);
            trayIcon.ContextMenu = new ContextMenu(new MenuItem[] {
                statusMenuItem,
                openMenuItem,
                //new("Debug Console", DebugConsole),
                runWhenStarts,
                new("Check for Update...", CheckForUpdate),
                new("Visit GitHub...", VisitGitHub),
                new("About", About),
                new("Exit", Exit),
            });

            trayIcon.MouseDoubleClick += new MouseEventHandler(Open);
            trayIcon.Visible = true;

            var hasUpdateFile = File.Exists("update");

            if (!hasUpdateFile && Directory.Exists("core") && Directory.Exists("node") && Directory.Exists("core/node_modules") && Directory.Exists("core/dist")) {
                // Go go go
                StartProcess();
            } else {
                DownloadFiles();
            }
        }

        void DownloadFiles() {
            var form = new DownloadForm();
            form.Closed += Exit;
            form.Show();
        }

        private void RunWhenStarts(object sender, EventArgs e) {
            if (registryKey == null) {
                MessageBox.Show("Error: Unable to set startup registry key.");
                return;
            }

            if (runWhenStarts.Checked) {
                registryKey.DeleteValue(appName, false);
                runWhenStarts.Checked = false;
            } else {
                registryKey.SetValue(appName, Application.ExecutablePath);
                runWhenStarts.Checked = true;
            }
        }

        void StartProcess() {
            var startInfo = new ProcessStartInfo {
                FileName = "node/node.exe",
                Arguments = "server/server.js --data-dir=\"../data/\"",
                RedirectStandardOutput = false,
                RedirectStandardError = false,
                UseShellExecute = false,
                CreateNoWindow = true,
                WorkingDirectory = "core"
            };

            process = new Process();
            process.StartInfo = startInfo;
            process.EnableRaisingEvents = true;
            process.Exited += ProcessExited;

            try {
                process.Start();
                //Open(null, null);

                // Async task to check if the server is ready
                Task.Run(() => {
                    var runningText = "Server is running";
                    using TcpClient tcpClient = new TcpClient();
                    while (true) {
                        try {
                            tcpClient.Connect("127.0.0.1", 3001);
                            statusMenuItem.Text = runningText;
                            openMenuItem.Enabled = true;
                            trayIcon.Text = runningText;
                            break;
                        } catch (Exception) {
                            System.Threading.Thread.Sleep(2000);
                        }
                    }
                });

            } catch (Exception e) {
                MessageBox.Show("Startup failed: " + e.Message, "Uptime Kuma Error");
            }
        }

        void StopProcess() {
            process?.Kill();
        }

        void Open(object sender, EventArgs e) {
            Process.Start("http://localhost:3001");
        }

        void DebugConsole(object sender, EventArgs e) {

        }

        void CheckForUpdate(object sender, EventArgs e) {
            var needUpdate = false;

            // Check version.json exists
            if (File.Exists("version.json")) {
                // Load version.json and compare with the latest version from GitHub
                var currentVersionObj = JsonConvert.DeserializeObject<Version>(File.ReadAllText("version.json"));

                var versionJson = new WebClient().DownloadString("https://uptime.kuma.pet/version");
                var latestVersionObj = JsonConvert.DeserializeObject<Version>(versionJson);

                // Compare version, if the latest version is newer, then update
                if (new System.Version(latestVersionObj.latest).CompareTo(new System.Version(currentVersionObj.latest)) > 0) {
                    var result = MessageBox.Show("A new version is available. Do you want to update?", "Update", MessageBoxButtons.YesNo);
                    if (result == DialogResult.Yes) {
                        // Create a empty file `update`, so the app will download the core files again at startup
                        File.Create("update").Close();

                        trayIcon.Visible = false;
                        process?.Kill();

                        // Restart the app, it will download the core files again at startup
                        Application.Restart();
                    }
                } else {
                    MessageBox.Show("You are using the latest version.");
                }
            }


        }

        void VisitGitHub(object sender, EventArgs e)
        {
            Process.Start("https://github.com/louislam/uptime-kuma");
        }

        void About(object sender, EventArgs e)
        {
            MessageBox.Show("Uptime Kuma Windows Runtime v1.0.0" + Environment.NewLine + "© 2023 Louis Lam", "Info");
        }

        void Exit(object sender, EventArgs e)
        {
            // Hide tray icon, otherwise it will remain shown until user mouses over it
            trayIcon.Visible = false;
            process?.Kill();
            Application.Exit();
        }

        void ProcessExited(object sender, EventArgs e) {

            if (process.ExitCode != 0) {
                var line = "";
                while (!process.StandardOutput.EndOfStream)
                {
                    line += process.StandardOutput.ReadLine();
                }

                MessageBox.Show("Uptime Kuma exited unexpectedly. Exit code: " + process.ExitCode + " " + line);
            }

            trayIcon.Visible = false;
            Application.Exit();
        }

    }
}

