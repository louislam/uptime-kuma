const { test } = require("node:test");

const assert = require("node:assert");

const { checkCertificateHostname } = require("../../server/util-server");

const testCert = `
-----BEGIN CERTIFICATE-----
MIIFCTCCA/GgAwIBAgISBEROD0/r+BjpW4TvWCcZYxjpMA0GCSqGSIb3DQEBCwUA
MDIxCzAJBgNVBAYTAlVTMRYwFAYDVQQKEw1MZXQncyBFbmNyeXB0MQswCQYDVQQD
EwJSMzAeFw0yMzA5MDQxMjExMThaFw0yMzEyMDMxMjExMTdaMBQxEjAQBgNVBAMM
CSouZWZmLm9yZzCCASIwDQYJKoZIhvcNAQEBBQADggEPADCCAQoCggEBALywpmHr
GOFlhw9CcW11fVloL6dceeUexbIwVd/gOt0/rIlgBViOGCh1pFYA/Essty4vXBzx
cp6W4WurmwU6ZOJA0/T6rxnmsjxSdrHVGBGgW18HJ9IWqBl9MigjpRo9h4SlAPJq
cAsiBfPhQ0oSe/8IqwgKA4HTvlcTf5/HKnbe0MyQt7WNILWHm+zpfLE0AmLVXxqA
MNc/ynQDLTsWDZnqqri4MKOW1yOAMbUoAWSsNaagoGnZU4bg8uhu/2JTi/vdjl0g
fTDOjsELc70cWekZ9Mv4ND4w3SEthotbMCCtZE5bUqcGzSm4pQEJ37kQ7xjJ0onT
RRcuZI6/jDWzwZ0CAwEAAaOCAjUwggIxMA4GA1UdDwEB/wQEAwIFoDAdBgNVHSUE
FjAUBggrBgEFBQcDAQYIKwYBBQUHAwIwDAYDVR0TAQH/BAIwADAdBgNVHQ4EFgQU
hTqVTd8TZ2pknzGJtKw2JaIrPJAwHwYDVR0jBBgwFoAUFC6zF7dYVsuuUAlA5h+v
nYsUwsYwVQYIKwYBBQUHAQEESTBHMCEGCCsGAQUFBzABhhVodHRwOi8vcjMuby5s
ZW5jci5vcmcwIgYIKwYBBQUHMAKGFmh0dHA6Ly9yMy5pLmxlbmNyLm9yZy8wPwYD
VR0RBDgwNoIJKi5lZmYub3JnghEqLnN0YWdpbmcuZWZmLm9yZ4IWd3d3Lmh0dHBz
LXJ1bGVzZXRzLm9yZzATBgNVHSAEDDAKMAgGBmeBDAECATCCAQMGCisGAQQB1nkC
BAIEgfQEgfEA7wB2ALc++yTfnE26dfI5xbpY9Gxd/ELPep81xJ4dCYEl7bSZAAAB
imBRp0EAAAQDAEcwRQIhAMW3HZwWZWXPWfahH2pr/lxCcoSluHv2huAW6rlzU3zn
AiAOzD/p8F3gT1bzDgdSW+X5WDBeU+EutRbHMSV+Cx0mZwB1AHoyjFTYty22IOo4
4FIe6YQWcDIThU070ivBOlejUutSAAABimBRqRQAAAQDAEYwRAIgFXvRRZS3xx83
XdTsnto5SxSnGi1+YfzYobMdV1yqHGACIDurLvkt58TwifUbyXflGZJmOMhcC2G1
KUd29yCUjIahMA0GCSqGSIb3DQEBCwUAA4IBAQA6t2F3PKMLlb2A/JsQhPFUJLS3
6cx+97dzROQLBdnUQIMxPkJBN/lltNdsVxJa4A3DMbrJOayefX2l8UIvFiEFVseF
WrxbmXDF68fwhBKBgeqZ25/S8jEdP5PWYWXHgXvx0zRdhfe9vuba5WeFyz79cR7K
t3bSyv6GMJ2z3qBkVFGHSeYakcxPWes3CNmGxInwZNBXA2oc7xuncFrjno/USzUI
nEefDfF3H3jC+0iP3IpsK8orwgWz4lOkcMYdan733lSZuVJ6pm7C9phTV04NGF3H
iPenGDCg1awOyRnvxNq1MtMDkR9AHwksukzwiYNexYjyvE2t0UzXhFXwazQ3
-----END CERTIFICATE-----
`;

test("Certificate and hostname match", () => {
    const result = checkCertificateHostname(testCert, "www.eff.org");
    assert.strictEqual(result, true);
});

test("Certificate and hostname mismatch", () => {
    const result = checkCertificateHostname(testCert, "example.com");
    assert.strictEqual(result, false);
});
