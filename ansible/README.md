# Ansible Playbook to install uptime kuma using docker

This playbook comes with three roles

1. docker (to install docker)
2. nginx (to install nginx using docker with ssl)
3. uptime kuma (to install uptime kuma using docker)

To see more info see docker-compose, tasks and config files 
I will try to make this readme better

## To run it
1. install ansible see [here](https://docs.ansible.com/ansible/latest/installation_guide/intro_installation.html)
2. run `ansible-galaxy install -r ansible-requirements.yml` to get requirements
3. prepare inventory hosts
4. put your certificates in files section in nginx role with this structure below:
```
ansible -> roles -> nginx -> ssl -> <uptime kuma domain>.fullchain.pem
ansible -> roles -> nginx -> ssl -> <uptime kuma domain>.privkey.pem
```
5. to run playbook
```bash
ansible-playbook ./playbook.yml -i <your inventory path> --extra-vars "kuma_domain=<uptime kuma domain>"
```
you can use other ansible playbook options too

> Note: Replace `<uptime kuma domain>` with your desired domain for uptime kuma
> If you are not using root user as your ansible_user use -bK option to become root
