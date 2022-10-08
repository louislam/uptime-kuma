using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Diagnostics;
using System.IO;
using System.IO.Compression;
using System.Net;
using System.Threading;
using System.Threading.Tasks;
using System.Windows.Forms;

namespace UptimeKuma {
    public partial class DownloadForm : Form {
        private readonly Queue<DownloadItem> downloadQueue = new();
        private readonly WebClient webClient = new();
        private DownloadItem currentDownloadItem;

        public DownloadForm() {
            InitializeComponent();
        }

        private void DownloadForm_Load(object sender, EventArgs e) {
            webClient.DownloadProgressChanged += DownloadProgressChanged;
            webClient.DownloadFileCompleted += DownloadFileCompleted;

            if (!Directory.Exists("node")) {
                downloadQueue.Enqueue(new DownloadItem {
                    URL = "https://nodejs.org/dist/v16.17.1/node-v16.17.1-win-x64.zip",
                    Filename = "node.zip",
                    TargetFolder = "node"
                });
            }

            if (!Directory.Exists("node")) {
                downloadQueue.Enqueue(new DownloadItem {
                    URL = "https://github.com/louislam/uptime-kuma/archive/refs/tags/1.18.3.zip",
                    Filename = "core.zip",
                    TargetFolder = "core"
                });
            }

            DownloadNextFile();
        }

        void DownloadNextFile() {
            if (downloadQueue.Count > 0) {
                var item = downloadQueue.Dequeue();

                currentDownloadItem = item;

                // Download if the zip file is not existing
                if (!File.Exists(item.Filename)) {
                    label.Text = item.URL;
                    webClient.DownloadFileAsync(new Uri(item.URL), item.Filename);
                } else {
                    progressBar.Value = 100;
                    label.Text = "Use local " + item.Filename;
                    DownloadFileCompleted(null, null);
                }
            } else {
                npmSetup();
            }
        }

        void npmSetup() {
            if (Directory.Exists("core/node_modules")) {
               // Application.Restart();
            }

            label.Text = "npm run setup";
            progressBar.Value = 50;
            labelData.Text = "";

            var startInfo = new ProcessStartInfo {
                FileName = "cmd.exe",
                Arguments = "run setup",
                RedirectStandardOutput = false,
                RedirectStandardError = false,
                RedirectStandardInput = true,
                UseShellExecute = false,
                CreateNoWindow = false,
                WorkingDirectory = "core"
            };

            var process = new Process();
            process.StartInfo = startInfo;
            process.EnableRaisingEvents = true;
            process.Exited += (object _, EventArgs e) => {
               // Application.Restart();
               progressBar.Value = 100;

               if (process.ExitCode == 0) {
                   label.Text = "Done";
               } else {
                   label.Text = "Failed, exit code: " + process.ExitCode;
               }

            };
            process.Start();
            process.StandardInput.WriteLine("\"../node/npm\" run setup");
        }

        void DownloadProgressChanged(object sender, DownloadProgressChangedEventArgs e) {
            progressBar.Value = e.ProgressPercentage;
            var total = e.TotalBytesToReceive / 1024;
            var current = e.BytesReceived / 1024;

            if (total > 0) {
                labelData.Text = $"{current}KB/{total}KB";
            }
        }

        async void DownloadFileCompleted(object sender, AsyncCompletedEventArgs e) {
            Extract(currentDownloadItem);
            DownloadNextFile();
        }

        void Extract(DownloadItem item) {
            if (Directory.Exists(item.TargetFolder)) {
                var dir = new DirectoryInfo(item.TargetFolder);
                dir.Delete(true);
            }

            if (Directory.Exists("temp")) {
                var dir = new DirectoryInfo("temp");
                dir.Delete(true);
            }

            labelData.Text = $"Extracting {item.Filename}...";

            ZipFile.ExtractToDirectory(item.Filename, "temp");

            string[] dirList;

            // Move to the correct level
            dirList = Directory.GetDirectories("temp");



            if (dirList.Length > 0) {
                var dir = dirList[0];

                // As sometime ExtractToDirectory is still locking the directory, loop until ok
                while (true) {
                    try {
                        Directory.Move(dir, item.TargetFolder);
                        break;
                    } catch (Exception exception) {
                        Thread.Sleep(1000);
                    }
                }

            } else {
                MessageBox.Show("Unexcepted Error: Cannot move extracted files, folder not found.");
            }

            labelData.Text = $"Extracted";

            if (Directory.Exists("temp")) {
                var dir = new DirectoryInfo("temp");
                dir.Delete(true);
            }

            File.Delete(item.Filename);
        }
    }

    public class DownloadItem {
        public string URL { get; set; }
        public string Filename { get; set; }
        public string TargetFolder { get; set; }
    }
}

