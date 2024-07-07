import { initializeKeypair } from "./initializeKeypair"
import { Connection, clusterApiUrl, PublicKey, Keypair } from "@solana/web3.js"
import {
  Metaplex,
  keypairIdentity,
  bundlrStorage,
  toMetaplexFile,
  NftWithToken,
} from "@metaplex-foundation/js"
import * as fs from "fs"

interface NftData {
  name: string
  symbol: string
  description: string
  sellerFeeBasisPoints: number
  imageFile: string
}

// example data for a new NFT
const nftData = {
  name: "Nova",
  symbol: "Nova #1",
  description: "The biggest baddest NFT in town",
  sellerFeeBasisPoints: 0,
  imageFile: "solana.png",
}

// example data for updating an existing NFT
const updateNftData = {
  name: "Update",
  symbol: "UPDATE",
  description: "Update Description",
  sellerFeeBasisPoints: 100,
  imageFile: "success.png",
}

interface CollectionNftData {
  name: string
  symbol: string
  description: string
  sellerFeeBasisPoints: number
  imageFile: string,
  isCollection:boolean,
  collectionAuthority:Keypair
}



async function main() {
  // create a new connection to the cluster's API
  const connection = new Connection(clusterApiUrl("devnet"))

  // initialize a keypair for the user
  const user = await initializeKeypair(connection);

  //create the data for creating the NFT collection
  const collectionNftData = {
    name: "Nova Collection",
    symbol: "NOV",
    description: "The biggest baddest collection of NFTs on the Solana Blockchain!",
    sellerFeeBasisPoints: 100,
    imageFile: "success.png",
    isCollection: true,
    collectionAuthority: user,
  }

  //metaplex set up
  const metaplex = Metaplex.make(connection)
    .use(keypairIdentity(user))
    .use(
      bundlrStorage({
        address: "https://devnet.bundlr.network",
        providerUrl: "https://api.devnet.solana.com",
        timeout: 60000,
      }),
    )

  //upload the image and get the metadata uri
  const uri = await uploadMetadata(metaplex,nftData);

  //create the required NFT
  const nft =  await createNft(metaplex,uri,nftData);

  //create the collection metadata uri
  const collectionUri = await uploadMetadata(metaplex, collectionNftData);

  //create the NFT collection
  const collectionNft = await createCollectionNft(metaplex,
    collectionUri,
    collectionNftData
  );
  
  const collectionMint = collectionNft.address;




  console.log("PublicKey:", user.publicKey.toBase58())
}

//helper function to upload the image and the metadata
async function uploadMetadata(
  metaplex: Metaplex,
  nftData : NftData
): Promise<string>{
  //image file to buffer
  const buffer = fs.readFileSync("src/" + nftData.imageFile);

  //buffer to metaplex file
  const file = toMetaplexFile(buffer,nftData.imageFile);

  //upload image and get image uri
  const imageUri = await metaplex.storage().upload(file);
  console.log("image uri:", imageUri);

  //upload metadata and get metadata uri ( off chain metadata )
  const {uri} = await metaplex.nfts().uploadMetadata({
    name: nftData.name,
    symbol: nftData.symbol,
    description: nftData.description,
    image: imageUri,
  });


  console.log("Metadata URI : ",uri);
  return uri;
}

//helper function to create the NFT
async function createNft(
  metaplex:Metaplex,
  uri:string,
  nftData: NftData
):Promise<NftWithToken>{

  //create the nft
  const { nft } = await metaplex.nfts().create({
    uri:uri,
    name:nftData.name,
    sellerFeeBasisPoints:nftData.sellerFeeBasisPoints,
    symbol: nftData.symbol,
  },{
    commitment:"finalized"
  });

  //get the Solana Explorer link
  console.log(
    `Token Mint: https://explorer.solana.com/address/${nft.address.toString()}?cluster=devnet`,
  );

  //verifying the NFT with our collection address
  const collMint = new PublicKey('3EZ8U2E4JQgYAXPfCkGvdtNEm9EDyxeVmPExZn2sHGvs');
  await metaplex.nfts().verifyCollection({
    mintAddress:nft.mint.address,
    collectionMintAddress:collMint,
    isSizedCollection:true,
  });

  return nft;
}

//helper function to update the NFT uri
async function updateNftUri(
  metaplex:Metaplex,
  uri:string,
  mintAddress : PublicKey
){
  //function doesnt return anything -> find the particular NFT
  const nft = await metaplex.nfts().findByMint({mintAddress});

  //update the NFT metadata
  const { response } = await metaplex.nfts().update({
    nftOrSft:nft,
    uri:uri
  },
  {
    commitment:"finalized"
  },);

  console.log(
    `Token Mint: https://explorer.solana.com/address/${nft.address.toString()}?cluster=devnet`,
  );

  console.log(
    `Transaction: https://explorer.solana.com/tx/${response.signature}?cluster=devnet`,
  );
}

//create NFT collection helper function
async function createCollectionNft(
  metaplex: Metaplex,
  uri: string,
  data: CollectionNftData
):Promise<NftWithToken>{

  //same exact way of making the NFT -> the only difference is that we set isCollection to true
  const { nft } = await metaplex.nfts().create(
    {
      uri: uri,
      name: data.name,
      sellerFeeBasisPoints: data.sellerFeeBasisPoints,
      symbol: data.symbol,
      isCollection: true,
    },
    { commitment: "finalized" }
  )

  console.log(
    `Collection Mint: https://explorer.solana.com/address/${nft.address.toString()}?cluster=devnet`
  )

  return nft
}

main()
  .then(() => {
    console.log("Finished successfully")
    process.exit(0)
  })
  .catch((error) => {
    console.log(error)
    process.exit(1)
  })
