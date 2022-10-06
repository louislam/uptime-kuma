using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.Linq;
using System.Reflection;
using System.Threading.Tasks;
using System.Windows.Forms;
using UptimeKuma.Properties;

namespace UptimeKuma {
    static class Program {
        /// <summary>
        /// The main entry point for the application.
        /// </summary>
        [STAThread]
        static void Main() {
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
            // Initialize Tray Icon
            trayIcon = new NotifyIcon();

            trayIcon.Icon = Icon.ExtractAssociatedIcon(Assembly.GetExecutingAssembly().Location);
            trayIcon.ContextMenu = new ContextMenu(new MenuItem[] {
                new MenuItem("Open", Open),
                new MenuItem("Check for Update", CheckForUpdate),
                new MenuItem("About", About),
                new MenuItem("Exit", Exit),
            });

            trayIcon.Visible = true;

            var startInfo = new ProcessStartInfo();
            startInfo.FileName = "node/node.exe";
            startInfo.Arguments = "server/server.js";
            startInfo.RedirectStandardOutput = true;
            startInfo.RedirectStandardError = true;
            startInfo.UseShellExecute = false;
            startInfo.CreateNoWindow = true;
            startInfo.WorkingDirectory = "core";

            process = new Process();
            process.StartInfo = startInfo;
            process.EnableRaisingEvents = true;
            try {
                process.Start();
                Open(null, null);
            } catch (Exception e) {
                MessageBox.Show("Startup failed: " + e.Message, "Uptime Kuma Error");
                throw;
            }
        }

        void Open(object sender, EventArgs e) {
            Process.Start("http://localhost:3001");
        }

        void CheckForUpdate(object sender, EventArgs e) {

        }

        void About(object sender, EventArgs e)
        {
            MessageBox.Show("Uptime Kuma v1.0.0" + Environment.NewLine + "© 2022 Louis Lam", "Info");
        }

        void Exit(object sender, EventArgs e)
        {
            // Hide tray icon, otherwise it will remain shown until user mouses over it
            trayIcon.Visible = false;
            process.Close();
            Application.Exit();
        }
    }
}

