#!/usr/bin/env bash
# Generates a TEST-ONLY PKI mimicking Apple's JWS chain (custom OIDs) for offline tests.
# Output: tests/fixtures/apple-test-pki/{root.der,leaf.pk8.pem,chain.json}
set -euo pipefail
OUT="$(cd "$(dirname "$0")/.." && pwd)/tests/fixtures/apple-test-pki"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
cd "$TMP"

cat > root.cnf <<CNF
[req]
distinguished_name=dn
x509_extensions=v3
prompt=no
[dn]
CN=Kumaun Test Root
[v3]
basicConstraints=critical,CA:TRUE
keyUsage=critical,keyCertSign,cRLSign
CNF
cat > int.cnf <<CNF
basicConstraints=critical,CA:TRUE
keyUsage=critical,keyCertSign,cRLSign
1.2.840.113635.100.6.2.1=ASN1:NULL
CNF
cat > leaf.cnf <<CNF
basicConstraints=critical,CA:FALSE
keyUsage=critical,digitalSignature
1.2.840.113635.100.6.11.1=ASN1:NULL
CNF

for k in root int leaf; do openssl ecparam -name prime256v1 -genkey -noout -out $k.key; done
openssl req -new -x509 -key root.key -sha256 -days 36500 -config root.cnf -out root.pem
openssl req -new -key int.key -subj "/CN=Kumaun Test Intermediate" -out int.csr
openssl x509 -req -in int.csr -CA root.pem -CAkey root.key -CAcreateserial -days 36500 -sha256 -extfile int.cnf -out int.pem
openssl req -new -key leaf.key -subj "/CN=Kumaun Test Leaf" -out leaf.csr
openssl x509 -req -in leaf.csr -CA int.pem -CAkey int.key -CAcreateserial -days 36500 -sha256 -extfile leaf.cnf -out leaf.pem
openssl pkcs8 -topk8 -nocrypt -in leaf.key -out leaf.pk8.pem
openssl x509 -in root.pem -outform der -out root.der

b64der() { openssl x509 -in "$1" -outform der | base64 | tr -d '\n'; }
printf '["%s","%s","%s"]\n' "$(b64der leaf.pem)" "$(b64der int.pem)" "$(b64der root.pem)" > chain.json

mkdir -p "$OUT"
cp root.der leaf.pk8.pem chain.json "$OUT/"
echo "Wrote test PKI to $OUT"
