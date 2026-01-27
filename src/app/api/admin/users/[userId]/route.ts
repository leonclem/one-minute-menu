import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAdminApi } from '@/lib/admin-api-auth'
import { logger } from '@/lib/logger'
import { createAdminSupabaseClient } from '@/lib/supabase-server'

export async function PATCH(
  request: Request,
  { params }: { params: { userId: string } }
) {
  const { userId } = params
  
  // 1. Ensure only Admins can call this
  const auth = await requireAdminApi()
  if (!auth.ok) return auth.response

  try {
    const { plan } = await request.json()
    
    if (!plan) {
      return NextResponse.json({ error: 'Plan is required' }, { status: 400 })
    }

    const supabaseAdmin = createAdminSupabaseClient()

    logger.info(`Admin ${auth.user.id} updating plan for user ${userId} to ${plan}`)

    const updateData: any = { plan }
    
    // If downgrading to free, clear subscription metadata
    if (plan === 'free') {
      updateData.subscription_status = null
      updateData.stripe_subscription_id = null
      updateData.subscription_period_end = null
    }

    const { data, error } = await supabaseAdmin
      .from('profiles')
      .update(updateData)
      .eq('id', userId)
      .select()
      .single()

    if (error) {
      logger.error(`Failed to update plan for user ${userId}`, error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true, 
      message: `User ${userId} plan updated to ${plan} successfully.`,
      data
    })

  } catch (error: any) {
    logger.error(`Critical error during user plan update for ${userId}`, error)
    return NextResponse.json(
      { error: error.message || 'Failed to update user plan' },
      { status: 500 }
    )
  }
}

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
      // List all files recursively in the user's folder
      // We need a recursive helper because Supabase list() doesn't support it
      const getAllFiles = async (path: string): Promise<string[]> => {
        const { data, error } = await supabaseAdmin.storage
          .from(bucket)
          .list(path)

        if (error) {
          logger.error(`Failed to list storage for user ${userId} in bucket ${bucket} at path ${path}`, error)
          return []
        }

        let files: string[] = []
        if (data) {
          for (const item of data) {
            const fullPath = `${path}/${item.name}`
            // Folders in Supabase Storage don't have metadata or id
            if (!item.id && !item.metadata) {
              const subFiles = await getAllFiles(fullPath)
              files.push(...subFiles)
            } else {
              files.push(fullPath)
            }
          }
        }
        return files
      }

      const paths = await getAllFiles(userId)

      if (paths.length > 0) {
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
