import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAdminApi } from '@/lib/admin-api-auth'
import { logger } from '@/lib/logger'

export async function DELETE(
  request: Request,
  { params }: { params: { userId: string } }
) {
  const { userId } = params
  
  // 1. Ensure only Admins can call this
  const auth = await requireAdminApi()
  if (!auth.ok) return auth.response

  // 2. Initialize Supabase Admin (Service Role) 
  // We need the service role to delete users and files bypass RLS
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  logger.info(`Admin ${auth.user.id} initiated deletion for user ${userId}`)

  try {
    // --- Step A: Cleanup Storage ---
    const buckets = ['menu-images', 'ai-generated-images']
    const deletedFiles: string[] = []
    
    for (const bucket of buckets) {
      // List all files in the user's folder
      // In Supabase Storage, listing a "folder" is listing files with that prefix
      const { data: files, error: listError } = await supabaseAdmin.storage
        .from(bucket)
        .list(userId, { recursive: true })

      if (listError) {
        logger.error(`Failed to list storage for user ${userId} in bucket ${bucket}`, listError)
        continue
      }

      if (files && files.length > 0) {
        const paths = files.map(f => `${userId}/${f.name}`)
        const { error: removeError } = await supabaseAdmin.storage.from(bucket).remove(paths)
        
        if (removeError) {
          logger.error(`Failed to remove files for user ${userId} from bucket ${bucket}`, removeError)
        } else {
          deletedFiles.push(...paths)
          logger.info(`Deleted ${paths.length} files from ${bucket} for user ${userId}`)
        }
      }
    }

    // --- Step B: Delete the Auth User ---
    // This triggers the DB CASCADE via migration 029 and deletes everything else automatically
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId)
    
    if (deleteError) {
      logger.error(`Failed to delete auth user ${userId}`, deleteError)
      throw deleteError
    }

    logger.info(`User ${userId} and all associated data deleted successfully by admin ${auth.user.id}`)

    return NextResponse.json({ 
      success: true, 
      message: `User ${userId} and all associated data deleted successfully.`,
      storageCleanup: {
        bucketsProcessed: buckets,
        filesRemoved: deletedFiles.length
      }
    })

  } catch (error: any) {
    logger.error(`Critical error during user deletion for ${userId}`, error)
    return NextResponse.json(
      { error: error.message || 'Failed to delete user' },
      { status: 500 }
    )
  }
}
