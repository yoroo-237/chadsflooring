const { HDNodeWallet, ethers } = require('ethers');
const prisma = require('../../db');
const { success, error } = require('../../utils/apiResponse');

async function sweepEth(req, res) {
  const phrase = process.env.ETH_HD_SEED;
  if (!phrase) return error(res, 'ETH_HD_SEED not configured on the server.', 500);

  const apiKey = process.env.ALCHEMY_API_KEY;
  if (!apiKey) return error(res, 'ALCHEMY_API_KEY not configured on the server.', 500);

  const destSetting = await prisma.siteSetting.findUnique({ where: { key: 'eth_address' } });
  if (!destSetting?.value) {
    return error(res, 'ETH destination address not set — go to Settings → Crypto and enter your ETH address.', 400);
  }
  const destination = destSetting.value;

  const provider = new ethers.JsonRpcProvider(
    `https://eth-mainnet.g.alchemy.com/v2/${apiKey}`
  );

  const deposits = await prisma.deposit.findMany({
    where: { currency: 'ETH', status: 'confirmed', ethIndex: { not: null } },
    select: { id: true, ethIndex: true, address: true },
  });

  const swept   = [];
  const skipped = [];

  for (const dep of deposits) {
    try {
      const wallet  = HDNodeWallet
        .fromPhrase(phrase, undefined, `m/44'/60'/0'/0/${dep.ethIndex}`)
        .connect(provider);

      const balance = await provider.getBalance(wallet.address);
      if (balance === 0n) {
        skipped.push({ address: dep.address, reason: 'empty' });
        continue;
      }

      const feeData  = await provider.getFeeData();
      const gasPrice = feeData.maxFeePerGas || feeData.gasPrice || ethers.parseUnits('20', 'gwei');
      const gasCost  = 21000n * gasPrice;

      if (balance <= gasCost) {
        skipped.push({ address: dep.address, reason: 'balance too low to cover gas' });
        continue;
      }

      const tx = await wallet.sendTransaction({
        to:       destination,
        value:    balance - gasCost,
        gasLimit: 21000n,
      });

      swept.push({
        address:   dep.address,
        txHash:    tx.hash,
        amountEth: ethers.formatEther(balance - gasCost),
      });
    } catch (e) {
      skipped.push({ address: dep.address, reason: e.message });
    }
  }

  return success(res, { swept: swept.length, results: swept, skipped });
}

module.exports = { sweepEth };
