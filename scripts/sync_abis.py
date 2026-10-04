import json
import glob
import os

abi_dir = "contracts/abi"
out = ["/* Auto-generated contract ABIs */"]

for f in sorted(glob.glob(os.path.join(abi_dir, "*.json"))):
    name = os.path.basename(f)[:-5]
    with open(f, "r") as fp:
        data = json.load(fp)
    out.append(f"export const {name}Abi = {json.dumps(data['abi'])};")

with open("frontend/src/contracts/abis.ts", "w") as fp:
    fp.write("\n".join(out) + "\n")

print(f"Updated abis.ts with {len(out) - 1} ABIs")
