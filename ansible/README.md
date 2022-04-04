# Ansible Playbook to install uptime kuma using docker

This playbook comes with three tags

1. requirements (will install anything needed to make next parts working)
2. docker (to install docker)
3. nginx (to install nginx using docker with ssl)
4. uptime kuma (to install uptime kuma using docker)

To see more info see docker-compose, tasks and config files 
I will try to make this readme better

## To run it
1. install ansible see [here](https://docs.ansible.com/ansible/latest/installation_guide/intro_installation.html)
2. run `ansible-galaxy install -r ansible-requirements.yml` to get requirements
3. prepare inventory hosts
4. put your certificates in files section in nginx role with this structure below:
```
ansible -> roles -> nginx -> files -> ssl -> <uptime kuma domain>.fullchain.pem
ansible -> roles -> nginx -> files -> ssl -> <uptime kuma domain>.privkey.pem
```
5. to run playbook
```bash
ansible-playbook ./playbook.yml -i <your inventory path> -e "kuma_domain=<uptime kuma domain>" -e "kuma_image_os=<alpine or debian>" -e "kuma_image_version=<version>"
```
you can use other ansible playbook options too

> Note: Replace `<uptime kuma domain>` with your desired domain for uptime kuma

> replace `<version>` with a version from https://github.com/louislam/uptime-kuma/releases
> replace `<alpine or debian>` with one of options

> `-e "kuma_image_os=<alpine or debian>" -e "kuma_image_version=<version>"` is not required and you can remove this part or change only one of them (kuma_image_os is debian & kuma_image_version is 1 by default)

> If you are not using root user as your ansible_user use -bK option to become root

> instead of `-e "kuma_image_os=<alpine or debian>" -e "kuma_image_version=<version>"` You can use `-e kuma_tag=<uptime kuma full tag>` and replace `<uptime kuma full tag>` with your desired tag (e.g. `latest`)

> you can also create a yaml file with variables that you want to set & use it (also: ansible-vars)
