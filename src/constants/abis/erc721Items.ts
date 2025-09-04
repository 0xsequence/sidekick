export const erc721ItemsAbi = [
	{
		type: 'constructor',
		inputs: [],
		stateMutability: 'nonpayable'
	},
	{
		type: 'function',
		name: 'DEFAULT_ADMIN_ROLE',
		inputs: [],
		outputs: [
			{
				name: '',
				type: 'bytes32',
				internalType: 'bytes32'
			}
		],
		stateMutability: 'view'
	},
	{
		type: 'function',
		name: 'acceptImplicitRequest',
		inputs: [
			{
				name: 'wallet',
				type: 'address',
				internalType: 'address'
			},
			{
				name: 'attestation',
				type: 'tuple',
				internalType: 'struct Attestation',
				components: [
					{
						name: 'approvedSigner',
						type: 'address',
						internalType: 'address'
					},
					{
						name: 'identityType',
						type: 'bytes4',
						internalType: 'bytes4'
					},
					{
						name: 'issuerHash',
						type: 'bytes32',
						internalType: 'bytes32'
					},
					{
						name: 'audienceHash',
						type: 'bytes32',
						internalType: 'bytes32'
					},
					{
						name: 'applicationData',
						type: 'bytes',
						internalType: 'bytes'
					},
					{
						name: 'authData',
						type: 'tuple',
						internalType: 'struct AuthData',
						components: [
							{
								name: 'redirectUrl',
								type: 'string',
								internalType: 'string'
							},
							{
								name: 'issuedAt',
								type: 'uint64',
								internalType: 'uint64'
							}
						]
					}
				]
			},
			{
				name: 'call',
				type: 'tuple',
				internalType: 'struct Payload.Call',
				components: [
					{
						name: 'to',
						type: 'address',
						internalType: 'address'
					},
					{
						name: 'value',
						type: 'uint256',
						internalType: 'uint256'
					},
					{
						name: 'data',
						type: 'bytes',
						internalType: 'bytes'
					},
					{
						name: 'gasLimit',
						type: 'uint256',
						internalType: 'uint256'
					},
					{
						name: 'delegateCall',
						type: 'bool',
						internalType: 'bool'
					},
					{
						name: 'onlyFallback',
						type: 'bool',
						internalType: 'bool'
					},
					{
						name: 'behaviorOnError',
						type: 'uint256',
						internalType: 'uint256'
					}
				]
			}
		],
		outputs: [
			{
				name: '',
				type: 'bytes32',
				internalType: 'bytes32'
			}
		],
		stateMutability: 'view'
	},
	{
		type: 'function',
		name: 'approve',
		inputs: [
			{
				name: 'account',
				type: 'address',
				internalType: 'address'
			},
			{
				name: 'id',
				type: 'uint256',
				internalType: 'uint256'
			}
		],
		outputs: [],
		stateMutability: 'payable'
	},
	{
		type: 'function',
		name: 'balanceOf',
		inputs: [
			{
				name: 'owner',
				type: 'address',
				internalType: 'address'
			}
		],
		outputs: [
			{
				name: 'result',
				type: 'uint256',
				internalType: 'uint256'
			}
		],
		stateMutability: 'view'
	},
	{
		type: 'function',
		name: 'batchBurn',
		inputs: [
			{
				name: 'tokenIds',
				type: 'uint256[]',
				internalType: 'uint256[]'
			}
		],
		outputs: [],
		stateMutability: 'nonpayable'
	},
	{
		type: 'function',
		name: 'burn',
		inputs: [
			{
				name: 'tokenId',
				type: 'uint256',
				internalType: 'uint256'
			}
		],
		outputs: [],
		stateMutability: 'nonpayable'
	},
	{
		type: 'function',
		name: 'contractURI',
		inputs: [],
		outputs: [
			{
				name: '',
				type: 'string',
				internalType: 'string'
			}
		],
		stateMutability: 'view'
	},
	{
		type: 'function',
		name: 'getApproved',
		inputs: [
			{
				name: 'id',
				type: 'uint256',
				internalType: 'uint256'
			}
		],
		outputs: [
			{
				name: 'result',
				type: 'address',
				internalType: 'address'
			}
		],
		stateMutability: 'view'
	},
	{
		type: 'function',
		name: 'getRoleAdmin',
		inputs: [
			{
				name: 'role',
				type: 'bytes32',
				internalType: 'bytes32'
			}
		],
		outputs: [
			{
				name: '',
				type: 'bytes32',
				internalType: 'bytes32'
			}
		],
		stateMutability: 'view'
	},
	{
		type: 'function',
		name: 'getRoleMember',
		inputs: [
			{
				name: 'role',
				type: 'bytes32',
				internalType: 'bytes32'
			},
			{
				name: 'index',
				type: 'uint256',
				internalType: 'uint256'
			}
		],
		outputs: [
			{
				name: '',
				type: 'address',
				internalType: 'address'
			}
		],
		stateMutability: 'view'
	},
	{
		type: 'function',
		name: 'getRoleMemberCount',
		inputs: [
			{
				name: 'role',
				type: 'bytes32',
				internalType: 'bytes32'
			}
		],
		outputs: [
			{
				name: '',
				type: 'uint256',
				internalType: 'uint256'
			}
		],
		stateMutability: 'view'
	},
	{
		type: 'function',
		name: 'grantRole',
		inputs: [
			{
				name: 'role',
				type: 'bytes32',
				internalType: 'bytes32'
			},
			{
				name: 'account',
				type: 'address',
				internalType: 'address'
			}
		],
		outputs: [],
		stateMutability: 'nonpayable'
	},
	{
		type: 'function',
		name: 'hasRole',
		inputs: [
			{
				name: 'role',
				type: 'bytes32',
				internalType: 'bytes32'
			},
			{
				name: 'account',
				type: 'address',
				internalType: 'address'
			}
		],
		outputs: [
			{
				name: '',
				type: 'bool',
				internalType: 'bool'
			}
		],
		stateMutability: 'view'
	},
	{
		type: 'function',
		name: 'initialize',
		inputs: [
			{
				name: 'owner',
				type: 'address',
				internalType: 'address'
			},
			{
				name: 'tokenName',
				type: 'string',
				internalType: 'string'
			},
			{
				name: 'tokenSymbol',
				type: 'string',
				internalType: 'string'
			},
			{
				name: 'tokenBaseURI',
				type: 'string',
				internalType: 'string'
			},
			{
				name: 'tokenContractURI',
				type: 'string',
				internalType: 'string'
			},
			{
				name: 'royaltyReceiver',
				type: 'address',
				internalType: 'address'
			},
			{
				name: 'royaltyFeeNumerator',
				type: 'uint96',
				internalType: 'uint96'
			},
			{
				name: 'implicitModeValidator',
				type: 'address',
				internalType: 'address'
			},
			{
				name: 'implicitModeProjectId',
				type: 'bytes32',
				internalType: 'bytes32'
			}
		],
		outputs: [],
		stateMutability: 'nonpayable'
	},
	{
		type: 'function',
		name: 'isApprovedForAll',
		inputs: [
			{
				name: 'owner',
				type: 'address',
				internalType: 'address'
			},
			{
				name: 'operator',
				type: 'address',
				internalType: 'address'
			}
		],
		outputs: [
			{
				name: 'result',
				type: 'bool',
				internalType: 'bool'
			}
		],
		stateMutability: 'view'
	},
	{
		type: 'function',
		name: 'mint',
		inputs: [
			{
				name: 'to',
				type: 'address',
				internalType: 'address'
			},
			{
				name: 'tokenId',
				type: 'uint256',
				internalType: 'uint256'
			}
		],
		outputs: [],
		stateMutability: 'nonpayable'
	},
	{
		type: 'function',
		name: 'mintSequential',
		inputs: [
			{
				name: 'to',
				type: 'address',
				internalType: 'address'
			},
			{
				name: 'amount',
				type: 'uint256',
				internalType: 'uint256'
			}
		],
		outputs: [],
		stateMutability: 'nonpayable'
	},
	{
		type: 'function',
		name: 'name',
		inputs: [],
		outputs: [
			{
				name: '',
				type: 'string',
				internalType: 'string'
			}
		],
		stateMutability: 'view'
	},
	{
		type: 'function',
		name: 'ownerOf',
		inputs: [
			{
				name: 'id',
				type: 'uint256',
				internalType: 'uint256'
			}
		],
		outputs: [
			{
				name: 'result',
				type: 'address',
				internalType: 'address'
			}
		],
		stateMutability: 'view'
	},
	{
		type: 'function',
		name: 'renounceRole',
		inputs: [
			{
				name: 'role',
				type: 'bytes32',
				internalType: 'bytes32'
			},
			{
				name: 'account',
				type: 'address',
				internalType: 'address'
			}
		],
		outputs: [],
		stateMutability: 'nonpayable'
	},
	{
		type: 'function',
		name: 'revokeRole',
		inputs: [
			{
				name: 'role',
				type: 'bytes32',
				internalType: 'bytes32'
			},
			{
				name: 'account',
				type: 'address',
				internalType: 'address'
			}
		],
		outputs: [],
		stateMutability: 'nonpayable'
	},
	{
		type: 'function',
		name: 'royaltyInfo',
		inputs: [
			{
				name: 'tokenId',
				type: 'uint256',
				internalType: 'uint256'
			},
			{
				name: 'salePrice',
				type: 'uint256',
				internalType: 'uint256'
			}
		],
		outputs: [
			{
				name: '',
				type: 'address',
				internalType: 'address'
			},
			{
				name: '',
				type: 'uint256',
				internalType: 'uint256'
			}
		],
		stateMutability: 'view'
	},
	{
		type: 'function',
		name: 'safeTransferFrom',
		inputs: [
			{
				name: 'from',
				type: 'address',
				internalType: 'address'
			},
			{
				name: 'to',
				type: 'address',
				internalType: 'address'
			},
			{
				name: 'id',
				type: 'uint256',
				internalType: 'uint256'
			}
		],
		outputs: [],
		stateMutability: 'payable'
	},
	{
		type: 'function',
		name: 'safeTransferFrom',
		inputs: [
			{
				name: 'from',
				type: 'address',
				internalType: 'address'
			},
			{
				name: 'to',
				type: 'address',
				internalType: 'address'
			},
			{
				name: 'id',
				type: 'uint256',
				internalType: 'uint256'
			},
			{
				name: 'data',
				type: 'bytes',
				internalType: 'bytes'
			}
		],
		outputs: [],
		stateMutability: 'payable'
	},
	{
		type: 'function',
		name: 'setApprovalForAll',
		inputs: [
			{
				name: 'operator',
				type: 'address',
				internalType: 'address'
			},
			{
				name: 'isApproved',
				type: 'bool',
				internalType: 'bool'
			}
		],
		outputs: [],
		stateMutability: 'nonpayable'
	},
	{
		type: 'function',
		name: 'setBaseMetadataURI',
		inputs: [
			{
				name: 'tokenBaseURI',
				type: 'string',
				internalType: 'string'
			}
		],
		outputs: [],
		stateMutability: 'nonpayable'
	},
	{
		type: 'function',
		name: 'setContractURI',
		inputs: [
			{
				name: 'tokenContractURI',
				type: 'string',
				internalType: 'string'
			}
		],
		outputs: [],
		stateMutability: 'nonpayable'
	},
	{
		type: 'function',
		name: 'setDefaultRoyalty',
		inputs: [
			{
				name: 'receiver',
				type: 'address',
				internalType: 'address'
			},
			{
				name: 'feeNumerator',
				type: 'uint96',
				internalType: 'uint96'
			}
		],
		outputs: [],
		stateMutability: 'nonpayable'
	},
	{
		type: 'function',
		name: 'setImplicitModeProjectId',
		inputs: [
			{
				name: 'projectId',
				type: 'bytes32',
				internalType: 'bytes32'
			}
		],
		outputs: [],
		stateMutability: 'nonpayable'
	},
	{
		type: 'function',
		name: 'setImplicitModeValidator',
		inputs: [
			{
				name: 'validator',
				type: 'address',
				internalType: 'address'
			}
		],
		outputs: [],
		stateMutability: 'nonpayable'
	},
	{
		type: 'function',
		name: 'setNameAndSymbol',
		inputs: [
			{
				name: 'tokenName',
				type: 'string',
				internalType: 'string'
			},
			{
				name: 'tokenSymbol',
				type: 'string',
				internalType: 'string'
			}
		],
		outputs: [],
		stateMutability: 'nonpayable'
	},
	{
		type: 'function',
		name: 'setTokenRoyalty',
		inputs: [
			{
				name: 'tokenId',
				type: 'uint256',
				internalType: 'uint256'
			},
			{
				name: 'receiver',
				type: 'address',
				internalType: 'address'
			},
			{
				name: 'feeNumerator',
				type: 'uint96',
				internalType: 'uint96'
			}
		],
		outputs: [],
		stateMutability: 'nonpayable'
	},
	{
		type: 'function',
		name: 'supportsInterface',
		inputs: [
			{
				name: 'interfaceId',
				type: 'bytes4',
				internalType: 'bytes4'
			}
		],
		outputs: [
			{
				name: '',
				type: 'bool',
				internalType: 'bool'
			}
		],
		stateMutability: 'view'
	},
	{
		type: 'function',
		name: 'symbol',
		inputs: [],
		outputs: [
			{
				name: '',
				type: 'string',
				internalType: 'string'
			}
		],
		stateMutability: 'view'
	},
	{
		type: 'function',
		name: 'tokenURI',
		inputs: [
			{
				name: 'tokenId',
				type: 'uint256',
				internalType: 'uint256'
			}
		],
		outputs: [
			{
				name: '',
				type: 'string',
				internalType: 'string'
			}
		],
		stateMutability: 'view'
	},
	{
		type: 'function',
		name: 'totalSupply',
		inputs: [],
		outputs: [
			{
				name: '',
				type: 'uint256',
				internalType: 'uint256'
			}
		],
		stateMutability: 'view'
	},
	{
		type: 'function',
		name: 'transferFrom',
		inputs: [
			{
				name: 'from',
				type: 'address',
				internalType: 'address'
			},
			{
				name: 'to',
				type: 'address',
				internalType: 'address'
			},
			{
				name: 'id',
				type: 'uint256',
				internalType: 'uint256'
			}
		],
		outputs: [],
		stateMutability: 'payable'
	},
	{
		type: 'event',
		name: 'Approval',
		inputs: [
			{
				name: 'owner',
				type: 'address',
				indexed: true,
				internalType: 'address'
			},
			{
				name: 'account',
				type: 'address',
				indexed: true,
				internalType: 'address'
			},
			{
				name: 'id',
				type: 'uint256',
				indexed: true,
				internalType: 'uint256'
			}
		],
		anonymous: false
	},
	{
		type: 'event',
		name: 'ApprovalForAll',
		inputs: [
			{
				name: 'owner',
				type: 'address',
				indexed: true,
				internalType: 'address'
			},
			{
				name: 'operator',
				type: 'address',
				indexed: true,
				internalType: 'address'
			},
			{
				name: 'isApproved',
				type: 'bool',
				indexed: false,
				internalType: 'bool'
			}
		],
		anonymous: false
	},
	{
		type: 'event',
		name: 'RoleAdminChanged',
		inputs: [
			{
				name: 'role',
				type: 'bytes32',
				indexed: true,
				internalType: 'bytes32'
			},
			{
				name: 'previousAdminRole',
				type: 'bytes32',
				indexed: true,
				internalType: 'bytes32'
			},
			{
				name: 'newAdminRole',
				type: 'bytes32',
				indexed: true,
				internalType: 'bytes32'
			}
		],
		anonymous: false
	},
	{
		type: 'event',
		name: 'RoleGranted',
		inputs: [
			{
				name: 'role',
				type: 'bytes32',
				indexed: true,
				internalType: 'bytes32'
			},
			{
				name: 'account',
				type: 'address',
				indexed: true,
				internalType: 'address'
			},
			{
				name: 'sender',
				type: 'address',
				indexed: true,
				internalType: 'address'
			}
		],
		anonymous: false
	},
	{
		type: 'event',
		name: 'RoleRevoked',
		inputs: [
			{
				name: 'role',
				type: 'bytes32',
				indexed: true,
				internalType: 'bytes32'
			},
			{
				name: 'account',
				type: 'address',
				indexed: true,
				internalType: 'address'
			},
			{
				name: 'sender',
				type: 'address',
				indexed: true,
				internalType: 'address'
			}
		],
		anonymous: false
	},
	{
		type: 'event',
		name: 'Transfer',
		inputs: [
			{
				name: 'from',
				type: 'address',
				indexed: true,
				internalType: 'address'
			},
			{
				name: 'to',
				type: 'address',
				indexed: true,
				internalType: 'address'
			},
			{
				name: 'id',
				type: 'uint256',
				indexed: true,
				internalType: 'uint256'
			}
		],
		anonymous: false
	},
	{
		type: 'error',
		name: 'AccountBalanceOverflow',
		inputs: []
	},
	{
		type: 'error',
		name: 'BalanceQueryForZeroAddress',
		inputs: []
	},
	{
		type: 'error',
		name: 'InvalidInitialization',
		inputs: []
	},
	{
		type: 'error',
		name: 'NotOwnerNorApproved',
		inputs: []
	},
	{
		type: 'error',
		name: 'TokenAlreadyExists',
		inputs: []
	},
	{
		type: 'error',
		name: 'TokenDoesNotExist',
		inputs: []
	},
	{
		type: 'error',
		name: 'TransferFromIncorrectOwner',
		inputs: []
	},
	{
		type: 'error',
		name: 'TransferToNonERC721ReceiverImplementer',
		inputs: []
	},
	{
		type: 'error',
		name: 'TransferToZeroAddress',
		inputs: []
	}
]
