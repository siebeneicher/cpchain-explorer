#!/usr/bin/env python

# Requires Python3.6 and pip3
# Install web3> pip3 install -U web3
# Install CPC> pip3 install cpc-fusion


import json
from cpc_fusion import Web3
from cpc_fusion.middleware import geth_poa_middleware

cf = Web3(Web3.HTTPProvider('http://127.0.0.1:8501'))
# inject the poa compatibility middleware to the innermost layer
#cf.middleware_stack.inject(geth_poa_middleware, layer=0)

rnodes = cf.cpc.getRNodes
generation = cf.cpc.getBlockGenerationInfo
out = {}
out['rnodes'] = rnodes

# convert AttrDict manually
out['generation'] = {'View': generation['View'], 'Term': generation['Term'], 'Proposer': generation['Proposer'], 'BlockNumber': generation['BlockNumber'], 'TermLen': generation['TermLen'], 'Proposers': generation['Proposers']}

print(json.dumps(out))
