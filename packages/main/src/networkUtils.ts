import * as ip from 'ip';
import network from 'network';

export function validateIPv4(ip: string) {
  if (typeof ip !== 'string') {
    return false;
  }

  // Regex expression for validating IPv4
  const ipv4 =
    /(([0-9]|[1-9][0-9]|1[0-9][0-9]|2[0-4][0-9]|25[0-5])\.){3}([0-9]|[1-9][0-9]|1[0-9][0-9]|2[0-4][0-9]|25[0-5])/;

  // Checking if it is a valid IPv4 addresses
  if (ip.match(ipv4)) {
    return true;
  }

  return false;
}

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

      const interfaceWithIp = list.find(
        iface => iface.netmask && iface.ip_address && !iface.ip_address.startsWith('169.254'),
      );

      if (interfaceWithIp) {
        activeInterface = interfaceWithIp;
      }

      console.log(activeInterface);

      const iface = activeInterface.name;
      const ipAddress = activeInterface.ip_address;
      const netmask = activeInterface.netmask;
      const gateway = activeInterface.gateway_ip;

      console.log(ipAddress, netmask);

      if (!netmask) {
        return resolve({
          interface: iface,
          ipAddress,
          netmask: '0.0.0.0',
          gateway: '0.0.0.0',
          firstIpOnSubnet: '0.0.0.0',
          lastIpOnSubnet: '0.0.0.0',
        });
      }

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
