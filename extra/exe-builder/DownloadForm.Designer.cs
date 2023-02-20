using System.ComponentModel;

namespace UptimeKuma {
    partial class DownloadForm {
        /// <summary>
        /// Required designer variable.
        /// </summary>
        private IContainer components = null;

        /// <summary>
        /// Clean up any resources being used.
        /// </summary>
        /// <param name="disposing">true if managed resources should be disposed; otherwise, false.</param>
        protected override void Dispose(bool disposing) {
            if (disposing && (components != null)) {
                components.Dispose();
            }

            base.Dispose(disposing);
        }

        #region Windows Form Designer generated code

        /// <summary>
        /// Required method for Designer support - do not modify
        /// the contents of this method with the code editor.
        /// </summary>
        private void InitializeComponent() {
            System.ComponentModel.ComponentResourceManager resources = new System.ComponentModel.ComponentResourceManager(typeof(DownloadForm));
            this.progressBar = new System.Windows.Forms.ProgressBar();
            this.label = new System.Windows.Forms.Label();
            this.labelData = new System.Windows.Forms.Label();
            this.SuspendLayout();
            // 
            // progressBar
            // 
            this.progressBar.Location = new System.Drawing.Point(12, 12);
            this.progressBar.Name = "progressBar";
            this.progressBar.Size = new System.Drawing.Size(472, 41);
            this.progressBar.TabIndex = 0;
            // 
            // label
            // 
            this.label.Location = new System.Drawing.Point(12, 59);
            this.label.Name = "label";
            this.label.Size = new System.Drawing.Size(472, 23);
            this.label.TabIndex = 1;
            this.label.Text = "Preparing...";
            // 
            // labelData
            // 
            this.labelData.Location = new System.Drawing.Point(12, 82);
            this.labelData.Name = "labelData";
            this.labelData.Size = new System.Drawing.Size(472, 23);
            this.labelData.TabIndex = 2;
            // 
            // DownloadForm
            // 
            this.AutoScaleDimensions = new System.Drawing.SizeF(8F, 16F);
            this.AutoScaleMode = System.Windows.Forms.AutoScaleMode.Font;
            this.ClientSize = new System.Drawing.Size(496, 117);
            this.Controls.Add(this.labelData);
            this.Controls.Add(this.label);
            this.Controls.Add(this.progressBar);
            this.FormBorderStyle = System.Windows.Forms.FormBorderStyle.FixedDialog;
            this.Icon = ((System.Drawing.Icon)(resources.GetObject("$this.Icon")));
            this.MaximizeBox = false;
            this.Name = "DownloadForm";
            this.StartPosition = System.Windows.Forms.FormStartPosition.CenterScreen;
            this.Text = "Uptime Kuma";
            this.Load += new System.EventHandler(this.DownloadForm_Load);
            this.ResumeLayout(false);
        }

        private System.Windows.Forms.Label labelData;

        private System.Windows.Forms.Label label;

        private System.Windows.Forms.ProgressBar progressBar;

        #endregion
    }
}

