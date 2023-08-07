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
    network.get_interfaces_list((err: string, list: GenericObject[]) => {
      if (err) {
        return reject(err);
      }

      if (!list.length) return reject('No active network interface found');
      let activeInterface = list[0];

      const interfaceWithIp = list.find((iface) => iface.netmask && iface.ip_address && !iface.ip_address.startsWith('169.254'));

      if (interfaceWithIp) {
        activeInterface = interfaceWithIp;
      }

      console.log(activeInterface);

      const iface = activeInterface.name;
      const ipAddress = activeInterface.ip_address;
      const netmask = activeInterface.netmask;
      const gateway = activeInterface.gateway_ip;

      console.log(ipAddress, netmask);

      const subnet = ip.subnet(ipAddress, netmask);

      console.log(subnet);

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