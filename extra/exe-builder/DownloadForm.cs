using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.IO;
using System.Net;
using System.Windows.Forms;

namespace UptimeKuma {
    public partial class DownloadForm : Form {
        private readonly Queue<DownloadItem> downloadQueue = new();
        private readonly WebClient webClient = new();

        public DownloadForm() {
            InitializeComponent();
        }

        private void DownloadForm_Load(object sender, EventArgs e) {
            webClient.DownloadProgressChanged += DownloadProgressChanged;
            webClient.DownloadFileCompleted += DownloadFileCompleted;

            if (!File.Exists("node")) {
                downloadQueue.Enqueue(new DownloadItem {
                    URL = "https://nodejs.org/dist/v16.17.1/node-v16.17.1-win-x64.zip",
                    Filename = "node.zip"
                });
            }

            if (!File.Exists("node")) {
                downloadQueue.Enqueue(new DownloadItem {
                    URL = "https://github.com/louislam/uptime-kuma/archive/refs/tags/1.18.3.zip",
                    Filename = "core.zip"
                });
            }

            DownloadNextFile();
        }

        void DownloadNextFile() {
            if (downloadQueue.Count > 0) {
                var item = downloadQueue.Dequeue();
                label.Text = item.URL;
                webClient.DownloadFileAsync(new Uri(item.URL), item.Filename);
            } else {
                // TODO: Finished, extract?
            }
        }

        void DownloadProgressChanged(object sender, DownloadProgressChangedEventArgs e) {
            progressBar.Value = e.ProgressPercentage;
            var total = e.TotalBytesToReceive / 1024;
            var current = e.BytesReceived / 1024;
            labelData.Text = $"{current}KB/{total}KB";
        }

        void DownloadFileCompleted(object sender, AsyncCompletedEventArgs  e) {
            DownloadNextFile();
        }
    }

    public class DownloadItem {
        public string URL { get; set; }
        public string Filename { get; set; }
    }
}

