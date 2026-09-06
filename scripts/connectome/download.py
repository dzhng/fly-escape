"""Fetch the full MaleCNS source, validating the server's content checksum."""
import base64
import hashlib
import json
from pathlib import Path
from urllib.request import urlopen

BASE = 'https://storage.googleapis.com/flyem-male-cns/v1.0/connectome-data/flat-connectome'
FILES = {
    'body-annotations.feather': 'body-annotations-male-cns-v1.0-minconf-0.5.feather',
    'body-neurotransmitters.feather': 'body-neurotransmitters-male-cns-v1.0.feather',
    'connectome-weights.feather': 'connectome-weights-male-cns-v1.0-minconf-0.5.feather',
}


def hashes(path):
    sha, md5 = hashlib.sha256(), hashlib.md5()
    with path.open('rb') as source:
        for block in iter(lambda: source.read(8 * 1024 * 1024), b''):
            sha.update(block)
            md5.update(block)
    return sha.hexdigest(), base64.b64encode(md5.digest()).decode()


def download(directory: Path):
    directory.mkdir(parents=True, exist_ok=True)
    sources = []
    for local, remote in FILES.items():
        url = f'{BASE}/{remote}'
        path = directory / local
        with urlopen(url, timeout=60) as response:
            size = int(response.headers['Content-Length'])
            remote_hashes = ','.join(response.headers.get_all('x-goog-hash', []))
            md5 = next(v.strip()[4:] for v in remote_hashes.split(',') if v.strip().startswith('md5='))
            generation = response.headers['x-goog-generation']
            valid = path.exists() and path.stat().st_size == size and hashes(path)[1] == md5
            if not valid:
                temporary = path.with_suffix('.part')
                try:
                    with temporary.open('wb') as output:
                        copied = 0
                        while block := response.read(8 * 1024 * 1024):
                            output.write(block)
                            copied += len(block)
                            if copied % (128 * 1024 * 1024) == 0:
                                print(f'{local}: {copied:,}/{size:,} bytes', flush=True)
                    if temporary.stat().st_size != size or hashes(temporary)[1] != md5:
                        raise ValueError(f'Incomplete or corrupt download: {url}')
                    temporary.replace(path)
                finally:
                    temporary.unlink(missing_ok=True)
        sha, _ = hashes(path)
        sources.append(dict(file=local, url=url, bytes=size, sha256=sha, generation=generation, md5=md5))
        print(f'Verified {local}: {size:,} bytes, sha256={sha}', flush=True)
    (directory / 'sources.json').write_text(json.dumps(sources, indent=2) + '\n')
    return sources


if __name__ == '__main__':
    import sys
    download(Path(sys.argv[1] if len(sys.argv) > 1 else 'data/raw'))
