// server/modules/monitor-restart-fields.js

// This module exports a reusable array of monitor form fields for the SSH restart functionality.
// These can be easily included in any monitor type.

module.exports = [
    {
        "type": "heading",
        "level": 4,
        "title": "Offline Auto-Restart (via SSH)",
    },
    {
        "type": "text",
        "name": "restartSshHost",
        "title": "SSH Host",
        "description": "The IP address or hostname of the remote server. If left blank, this feature will be disabled.",
        "placeholder": "e.g., 192.168.1.100"
    },
    {
        "type": "number",
        "name": "restartSshPort",
        "title": "SSH Port",
        "description": "The port for the SSH connection. Defaults to 22.",
        "default": 22
    },
    {
        "type": "textarea",
        "name": "restartSshPrivateKey",
        "title": "SSH Private Key",
        "description": "The content of the private key for SSH authentication. For security, it is recommended to create a dedicated, limited-privilege SSH key for this purpose.",
        "placeholder": "-----BEGIN RSA PRIVATE KEY-----\n..."
    },
    {
        "type": "text",
        "name": "restartScript",
        "title": "Restart Script",
        "description": "The command to be executed via SSH when the service is detected as offline.",
        "placeholder": "e.g., sudo systemctl restart my-app"
    }
];
