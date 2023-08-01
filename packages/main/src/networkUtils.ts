import * as ip from 'ip';
import network from 'network';

export function getNextIp(ip: string): IP {
  const splittedIp = ip.split('.');
  splittedIp[3] = (parseInt(splittedIp[3]) + 1).toString();
  return splittedIp.join('.');
}

export function getIpList(startIp: string, endIp: string): IP[] {
  const list = [startIp];

  let ip = startIp;

  do {
    ip = getNextIp(ip);
    list.push(ip);
  } while (ip !== endIp);

  return list;
}

export function getNetworkInfo(): Promise<NetworkInfo> {
  return new Promise((resolve, reject) => {
    network.get_active_interface((err: string, activeInterface: GenericObject) => {
      if (err) {
        return reject(err);
      }
      const iface = activeInterface.name;
      const ipAddress = activeInterface.ip_address;
      const netmask = activeInterface.netmask;
      const gateway = activeInterface.gateway_ip;

      const subnet = ip.subnet(ipAddress, netmask);

      const firstIpOnSubnet = subnet.firstAddress;
      const lastIpOnSubnet = subnet.lastAddress;

      return resolve({
        interface: iface,
        ipAddress,
        netmask,
        gateway,
        firstIpOnSubnet,
        lastIpOnSubnet,
      });
    });
  });
}