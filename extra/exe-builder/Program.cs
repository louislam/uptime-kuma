using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Linq;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Threading.Tasks;
using System.Windows.Forms;
using UptimeKuma.Properties;

namespace UptimeKuma {
    static class Program {
        /// <summary>
        /// The main entry point for the application.
        /// </summary>
        [STAThread]
        static void Main(string[] args) {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            Application.Run(new UptimeKumaApplicationContext());
        }
    }

    public class UptimeKumaApplicationContext : ApplicationContext
    {
        private NotifyIcon trayIcon;
        private Process process;

        public UptimeKumaApplicationContext()
        {
            trayIcon = new NotifyIcon();

            trayIcon.Icon = Icon.ExtractAssociatedIcon(Assembly.GetExecutingAssembly().Location);
            trayIcon.ContextMenu = new ContextMenu(new MenuItem[] {
                new("Open", Open),
                //new("Debug Console", DebugConsole),
                new("Check for Update...", CheckForUpdate),
                new("Visit GitHub...", VisitGitHub),
                new("About", About),
                new("Exit", Exit),
            });

            trayIcon.MouseDoubleClick += new MouseEventHandler(Open);
            trayIcon.Visible = true;

            if (Directory.Exists("core") && Directory.Exists("node") && Directory.Exists("core/node_modules")) {
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

            } catch (Exception e) {
                MessageBox.Show("Startup failed: " + e.Message, "Uptime Kuma Error");
            }
        }

        void Open(object sender, EventArgs e) {
            Process.Start("http://localhost:3001");
        }

        void DebugConsole(object sender, EventArgs e) {

        }

        void CheckForUpdate(object sender, EventArgs e) {
            Process.Start("https://github.com/louislam/uptime-kuma/releases");
        }

        void VisitGitHub(object sender, EventArgs e)
        {
            Process.Start("https://github.com/louislam/uptime-kuma");
        }

        void About(object sender, EventArgs e)
        {
            MessageBox.Show("Uptime Kuma v1.0.0" + Environment.NewLine + "© 2022 Louis Lam", "Info");
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

