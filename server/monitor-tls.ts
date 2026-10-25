import { checkCertificate, checkCertificateHostname } from "./util-server";

/** Minimal TLS socket shape needed for the certificate info */
export interface TlsSocketLike {
    authorized?: boolean;
    [key: string]: unknown;
}

export interface TlsInfoResult {
    certInfo: { raw: Buffer };
    valid?: boolean;
    hostnameMatchMonitorUrl?: boolean;
    [key: string]: unknown;
}

export interface TlsInfoDeps {
    checkCertificate: (socket: TlsSocketLike) => TlsInfoResult;
    checkCertificateHostname: (raw: Buffer, hostname?: string) => boolean;
}

const defaultDeps: TlsInfoDeps = {
    checkCertificate: (socket) => checkCertificate(socket),
    checkCertificateHostname: (raw, hostname) => checkCertificateHostname(raw, hostname),
};

/**
 * Build the certificate info of a TLS socket, including validity and hostname match
 * @param tlsSocket Connected TLS socket
 * @param hostname Hostname of the monitor URL
 * @param deps Injectable certificate helpers (tests)
 * @returns Certificate info
 */
export function readTlsInfo(
    tlsSocket: TlsSocketLike,
    hostname: string | undefined,
    deps: TlsInfoDeps = defaultDeps
): TlsInfoResult {
    const info = deps.checkCertificate(tlsSocket);
    info.valid = tlsSocket.authorized || false;
    info.hostnameMatchMonitorUrl = deps.checkCertificateHostname(info.certInfo.raw, hostname);
    return info;
}
