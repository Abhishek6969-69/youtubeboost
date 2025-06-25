import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { writeFile,unlink } from "fs/promises";
import * as fs from "fs";
import {v4 as uuidv4} from 'uuid'
import { IncomingForm } from "formidable";
import { Session } from "inspector/promises";
import { google } from "googleapis";



const oauth2Client=new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_REDIRECT_URI,
)


export async function POST(req: NextRequest) {
  console.log("🛠️ Upload route hit");
  
 
// console.log(formData.get("thumbnail"))

try{
    const session = await getServerSession(authOptions);
    if (!session || !session.user || !session.user.email) {
      
      return NextResponse.json({error:'Unauthorized'},{status:401}) 
    }
     
    const user=await prisma.user.findUnique({
        where:{
            email:session.user.email
        },
    })
    //  console.log(user);
    
    if (!user?.googleAccessToken && !user?.googleRefreshToken) {
      return NextResponse.json({ error: 'Missing Google tokens' }, { status: 403 });
    }
 const formData = await req.formData();
    const videoFile = formData.get('video') as File;
    const title=(formData.get('title') as string) || "untitled video"
    const descrption=(formData.get('descrption') as string) || "untitled descrption"
    const hashtags = (formData.get('hashtags') as string)?.split(',') || [];
    const thumbnail=formData.get('thumbnail') as File;
    // console.log(videoFile)
 if (!videoFile || typeof videoFile.name !== "string") {
  return NextResponse.json({ error: "Invalid or missing video file" }, { status: 400 });
}

     const arrayBuffer = await videoFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
//  console.log(oauth2Client,"bfhds")
    // Write file to /tmp folder
    const tempPath = `/tmp/${uuidv4()}-${videoFile.name}`;
    await writeFile(tempPath, buffer);
    console.log(formData)
    oauth2Client.setCredentials({
      access_token: user.googleAccessToken,
      refresh_token: user.googleRefreshToken,
    });

    oauth2Client.on('tokens', async (tokens) => {
      if (tokens.access_token) {
        if (session.user.email) {
          await prisma.user.update({
            where: { email: session.user.email },
            data: { googleAccessToken: tokens.access_token },
          });
        }
      }
    });
   const youtube=google.youtube({version:'v3',auth:oauth2Client});
   console.log(youtube);
  const res = await youtube.videos.insert({
      part: ['snippet', 'status'],
      requestBody: {
        snippet: {
          title:title,
          description:descrption,
          tags: hashtags,
          categoryId: 'uncategorized',
        },
        status: {
          privacyStatus: 'private',
        },
      },
      media: {
        body: fs.createReadStream(tempPath),
      },
    });

    // Clean up the temporary file
    await unlink(tempPath);

   
     return NextResponse.json({ data: "abc123" });
}



catch(error:any){
 console.error("Upload Error:", error);
    return NextResponse.json(
      { error: "Something went wrong", details: error.message },
      { status: 500 }
    );
}
  
}
