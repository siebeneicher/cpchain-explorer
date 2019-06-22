#!/usr/bin/env python

# Requires Python3.6 and pip3
# Install web3> pip3 install -U web3
# Install CPC> pip3 install cpc-fusion

import json, sys
from cpc_fusion import Web3
from cpc_fusion.middleware import geth_poa_middleware

cf = Web3(Web3.HTTPProvider('http://127.0.0.1:8501'))
# inject the poa compatibility middleware to the innermost layer
#cf.middleware_stack.inject(geth_poa_middleware, layer=0)

cpc_digits = 1000000000000000000

#print(sys.argv)

def action():
	action = sys.argv[1]
	out = {}

	if (action == "rnodes"):
		out = cf.cpc.getRNodes
	elif (action == "versions"):
		out = {
			"versionApi": cf.version.api,
			"versionNode": cf.version.node,
			"network": cf.version.network,
			"versionCpc": cf.version.cpchain
		}
	elif (action == "generation"):
		try:
			out = convertObj(cf.cpc.getBlockGenerationInfo)
		except Exception as err:
			print(json.dumps({"error": str(err)}))
			exit()
	elif (action == "transaction"):
		txn = sys.argv[2]
		try:
			out = convertObj(cf.cpc.getTransaction(txn))
		except Exception as err:
			print(json.dumps({"error": str(err)}))
			exit()
	elif (action == "balance"):
		try:
			addr = Web3.toChecksumAddress(sys.argv[2])
			#print(Web3.toChecksumAddress(addr))
			if len(sys.argv) > 3:
				block = int(sys.argv[3])
				out = {"balance": cf.cpc.getBalance(addr, block)}
			else:
				out = {"balance": cf.cpc.getBalance(addr, "latest")}

			if out['balance'] != 0:
				out['balance'] = out['balance'] / cpc_digits
		except Exception as err:
			print(json.dumps({"error": str(err)}))
			exit()
	elif (action == "blockNumber"):
		out = cf.cpc.blockNumber
	elif (action == "block"):
		block = cf.cpc.blockNumber
		if len(sys.argv) > 2:
			block = int(sys.argv[2])
		try:
			out = convertObj(cf.cpc.getBlock(block))
		except Exception as err:
			print(json.dumps({"error": str(err)}))
			exit()
	else:
		print("actions: rnodes, versions, generation, blockNumber, block, block NUM, balance, transaction")

	try:
		print(json.dumps(out))
	except Exception as err:
		print(json.dumps({"error": str(err)}))
	exit()

def convertObj(dictToParse):
    # convert any 'AttributeDict' type found to 'dict'
    parsedDict = dict(dictToParse)
    for key, val in parsedDict.items():
        # check for nested dict structures to iterate through
        if  'dict' in str(type(val)).lower():
            parsedDict[key] = convertObj(val)
        # convert 'HexBytes' type to 'str'
        elif 'HexBytes' in str(type(val)):
            parsedDict[key] = val.hex()
        elif 'list' in str(type(val)).lower():
            for i in range(len(val)):
            	if 'HexBytes' in str(type(parsedDict[key][i])):
                    parsedDict[key][i] = parsedDict[key][i].hex()
                #val[i] = convertObj(val[i])
    return parsedDict

action ()