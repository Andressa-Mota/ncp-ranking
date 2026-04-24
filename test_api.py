import urllib.request
try:
    with urllib.request.urlopen("https://ncp-ranking.vercel.app/api/turmas") as response:
        print(response.read().decode())
except urllib.error.HTTPError as e:
    print(e.read().decode())
