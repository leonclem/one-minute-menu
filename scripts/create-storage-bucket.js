// Script to create storage bucket manually
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'http://localhost:54321'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'

const supabase = createClient(supabaseUrl, supabaseKey)

async function createBucket() {
  try {
    console.log('Creating menu-images bucket...')
    
    // Create bucket (or ensure settings)
    const { data, error } = await supabase.storage.createBucket('menu-images', {
      public: true,
      fileSizeLimit: 8388608, // 8MB
      allowedMimeTypes: ['image/jpeg', 'image/jpg', 'image/png']
    })
    
    if (error) {
      if (error.message.includes('already exists')) {
        console.log('✅ Bucket already exists')
      } else {
        console.error('❌ Error creating bucket:', error)
      }
    } else {
      console.log('✅ Bucket created successfully:', data)
    }
    
    // Ensure bucket is public if already existed
    await supabase.storage.updateBucket('menu-images', {
      public: true,
      fileSizeLimit: 8388608,
      allowedMimeTypes: ['image/jpeg', 'image/jpg', 'image/png']
    })

    // List buckets to verify
    const { data: buckets, error: listError } = await supabase.storage.listBuckets()
    
    if (listError) {
      console.error('❌ Error listing buckets:', listError)
    } else {
      console.log('📁 Available buckets:', buckets.map(b => b.name))
    }
    
  } catch (error) {
    console.error('❌ Script error:', error)
  }
}

createBucket()