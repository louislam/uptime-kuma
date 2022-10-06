using System;
using System.Collections.Generic;
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

        public UptimeKumaApplicationContext()
        {
            // Initialize Tray Icon
            trayIcon = new NotifyIcon();

            trayIcon.Icon = Icon.ExtractAssociatedIcon(Assembly.GetExecutingAssembly().Location);
            trayIcon.ContextMenu = new ContextMenu(new MenuItem[] {
                new MenuItem("Check for Update", CheckForUpdate),
                new MenuItem("About", About),
                new MenuItem("Exit", Exit),
            });

            trayIcon.Visible = true;
        }

        void Exit(object sender, EventArgs e)
        {
            // Hide tray icon, otherwise it will remain shown until user mouses over it
            trayIcon.Visible = false;
            Application.Exit();
        }

        void About(object sender, EventArgs e)
        {
            MessageBox.Show("Uptime Kuma v1.0.0" + Environment.NewLine + "© 2022 Louis Lam", "Info");
        }

        void CheckForUpdate(object sneder, EventArgs e) {

        }
    }
}

