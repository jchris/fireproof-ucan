import * as Client from "@ucanto/client"
import * as Signer from "@ucanto/principal/ed25519";
import * as CAR from '@ucanto/transport/car'
import * as HTTP from '@ucanto/transport/http'
import { Store } from '@web3-storage/capabilities';
import { parseLink } from '@ucanto/core'
import { CID } from "multiformats";
import { Block, encode, decode } from "multiformats/block";
import { sha256 as hasher } from "multiformats/hashes/sha2";
import * as raw from "multiformats/codecs/raw";
import * as CBW from "@ipld/car/buffer-writer";
import * as codec from "@ipld/dag-cbor";
import { CarReader } from "@ipld/car";

import { readFileSync } from 'fs';
import { parse } from 'dotenv';


const envConfig = parse(readFileSync('./.dev.vars'));
const FIREPROOF_SERVICE_PRIVATE_KEY = envConfig.FIREPROOF_SERVICE_PRIVATE_KEY;


const serverId = Signer.parse(FIREPROOF_SERVICE_PRIVATE_KEY)
const carLink = parseLink(
  'bagbaierale63ypabqutmxxbz3qg2yzcp2xhz2yairorogfptwdd5n4lsz5xa'
)
export function connection (options = {}) {
  return Client.connect({
    id: serverId,
    codec: CAR.outbound,
    // @ts-ignore typing error we can fix later
    channel:
      HTTP.open({
        url: new URL("https://fireproof-ucan.jchris.workers.dev"),
//        url: new URL("http://localhost:8787"),
        method: 'POST',
        //fetch: globalThis.fetch.bind(globalThis),
      }),
  })
}

console.log(serverId.did())

const invocation = Store.add.invoke({
  audience: serverId,
  issuer: serverId,
  with: serverId.did(),
  nb: {
    link: carLink,
    size: 0
  }
})

const conn = connection()

// @ts-ignore TODO fix conn 
try {
	const response = await invocation.execute(conn);
	console.log(response.out);
} catch (e) {
	console.log('ERROR', e.stack);
	console.log('-----');
}


async function encodeString(s) {
  const myString = s;
  const block = await encode({
    value: { myString },
    hasher,
    codec,
  });

  const roots = [block.cid];
  const headerSize = CBW.headerLength({ roots });
  let size = headerSize + CBW.blockLength(block);
  const buffer = new Uint8Array(size);
  const writer = CBW.createWriter(buffer, { headerSize });

  writer.addRoot(block.cid);
  writer.write(block);
  writer.close();

  const carBlock = await encode({ value: writer.bytes, hasher, codec: raw });
  return carBlock
}

async function decodeString({cid, bytes}) {
  const reader = await CarReader.fromBytes(bytes);
  const roots = await reader.getRoots();
  const rootBlock = await reader.get(roots[0]);
  const { myString } = await decode(rootBlock);

  return myString;
}


async function saveString(s) {
  const carBlock = await encodeString(s);
  
  const invocation = Store.add.invoke({
    audience: serverId,
    issuer: serverId,
    with: serverId.did(),
    nb: {
      link: parseLink(carBlock.cid.toString()),
      size: carBlock.bytes.length
    }
  })

  // const conn = connection()

  // @ts-ignore TODO fix conn 
  try {
    const response = await invocation.execute(conn)
    console.log(response.out)
    if (response.out.error) {
      throw response.out.error
    }
    carLink = response.out.ok.link
  } catch (e) {
    console.log("ERROR", e.stack)
    console.log("-----")
    throw e
  }

  
  return carLink;
}


saveString("Hello, Fireproof!").then((link) => {
  console.log("Saved to", link)
  console.log("-----")
  console.log("Retrieving...")
  return link
})


