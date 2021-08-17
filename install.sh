"echo" "-e" "====================="
"echo" "-e" "Uptime Kuma Installer"
"echo" "-e" "====================="
"echo" "-e" ""
"echo" "-e" "---------------------------------------"
"echo" "-e" "This script is designed for Linux and basic usage."
"echo" "-e" "For advanced usage, please go to https://github.com/louislam/uptime-kuma/wiki/Installation"
"echo" "-e" "---------------------------------------"
"echo" "-e" ""
"echo" "-e" "Local - Install Uptime Kuma in your current machine with git, Node.js 14 and pm2"
"echo" "-e" "Docker - Install Uptime Kuma Docker container"
"echo" "-e" ""
"echo" "-e" "$1"
if [ "$1" != "" ]; then
  type="$1"
else
  "read" "-p" "Which installation method do you prefer? [DOCKER/local]: " "type"
fi
if [ "$type" == "local" ]; then
  "read" "-p" "Listening Port [3001]: " "port"
  if [ -e "/etc/redhat-release" ]; then
    os=$("cat" "/etc/redhat-release")
    distribution="rhel"  
fi
  arch=$(uname -i)
  "echo" "-e" "Your OS: ""$os"
  "echo" "-e" "Distribution: ""$distribution"
  "echo" "-e" "Arch: ""$arch"
  if [ "$distribution" == "rhel" ]; then
    nodePath=$(command -v node)
    if [ "$nodePath" != "" ]; then
      nodeVersion=$(node -e 'console.log(process.versions.node.split(`.`)[0])')
      "echo" "-e" "Node Version: ""$nodeVersion"
      _0="12"
      if [ $(($nodeVersion < $_0)) == 1 ]; then
        "echo" "-e" "Error: Required Node.js 14"
        "exit" "1"
      else
        if [ "$nodeVersion" == "12" ]; then
          "echo" "-e" "Warning: NodeJS ""$nodeVersion"" is not tested."        
fi
        "echo" "-e" "OK"
      fi
    else
-
    fi
    "yum" "install" "git" "-y"  
fi
else
  "read" "-p" "Expose Port [3001]: " "port"
  "read" "-p" "Volume Name [uptime-kuma]: " "volume"
fi
