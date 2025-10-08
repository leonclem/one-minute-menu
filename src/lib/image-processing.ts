import sharp from 'sharp';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

export interface ImageMetadata {
  menuItemId: string;
  generationJobId: string;
  originalPrompt: string;
  aspectRatio: string;
  generatedAt: Date;
}

export interface ProcessedImage {
  id: string;
  originalUrl: string;
  thumbnailUrl: string;
  mobileUrl: string;
  desktopUrl: string;
  webpUrl: string;
  jpegUrl: string;
  metadata: ImageMetadata;
  sizes: {
    original: number;
    thumbnail: number;
    mobile: number;
    desktop: number;
  };
}

export interface OptimizedImage {
  webp: {
    url: string;
    size: number;
  };
  jpeg: {
    url: string;
    size: number;
  };
}

export class ImageProcessingService {
  private readonly BUCKET_NAME = 'ai-generated-images';
  private readonly SIZES = {
    thumbnail: 150,
    mobile: 400,
    desktop: 800
  };
  private readonly MAX_SIZES = {
    thumbnail: 50 * 1024, // 50KB
    mobile: 200 * 1024,   // 200KB
    desktop: 500 * 1024   // 500KB
  };
  private supabase: SupabaseClient;

  constructor(supabaseClient?: SupabaseClient) {
    this.supabase = supabaseClient || createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }

  /**
   * Process base64 image from Nano Banana API
   */
  async processGeneratedImage(
    base64Data: string, 
    metadata: ImageMetadata,
    userId: string
  ): Promise<ProcessedImage> {
    try {
      // Decode base64 image
      const imageBuffer = Buffer.from(base64Data, 'base64');
      
      // Get original size
      const originalSize = imageBuffer.length;
      
      // Generate unique ID for this image set
      const imageId = crypto.randomUUID();
      const timestamp = Date.now();
      
      // Create different versions
      const [thumbnail, mobile, desktop, webp, jpeg] = await Promise.all([
        this.generateThumbnail(imageBuffer, this.SIZES.thumbnail),
        this.optimizeForSize(imageBuffer, this.SIZES.mobile, this.MAX_SIZES.mobile),
        this.optimizeForSize(imageBuffer, this.SIZES.desktop, this.MAX_SIZES.desktop),
        this.convertToWebP(imageBuffer),
        this.convertToJPEG(imageBuffer)
      ]);

      // Upload all versions to Supabase Storage with user-specific paths
      const basePath = `${userId}/${imageId}`;
      const uploadPromises = [
        this.uploadToStorage(`${basePath}/original_${timestamp}.jpg`, imageBuffer, 'image/jpeg'),
        this.uploadToStorage(`${basePath}/thumbnail_${timestamp}.webp`, thumbnail.buffer, 'image/webp'),
        this.uploadToStorage(`${basePath}/mobile_${timestamp}.webp`, mobile.buffer, 'image/webp'),
        this.uploadToStorage(`${basePath}/desktop_${timestamp}.webp`, desktop.buffer, 'image/webp'),
        this.uploadToStorage(`${basePath}/webp_${timestamp}.webp`, webp.buffer, 'image/webp'),
        this.uploadToStorage(`${basePath}/jpeg_${timestamp}.jpg`, jpeg.buffer, 'image/jpeg')
      ];

      const uploadResults = await Promise.all(uploadPromises);
      
      const processedImage: ProcessedImage = {
        id: imageId,
        originalUrl: uploadResults[0],
        thumbnailUrl: uploadResults[1],
        mobileUrl: uploadResults[2],
        desktopUrl: uploadResults[3],
        webpUrl: uploadResults[4],
        jpegUrl: uploadResults[5],
        metadata,
        sizes: {
          original: originalSize,
          thumbnail: thumbnail.size,
          mobile: mobile.size,
          desktop: desktop.size
        }
      };

      return processedImage;
    } catch (error) {
      console.error('Error processing generated image:', error);
      throw new Error(`Image processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate thumbnail version of image
   */
  async generateThumbnail(imageBuffer: Buffer, size: number): Promise<{ buffer: Buffer; size: number }> {
    const thumbnailBuffer = await sharp(imageBuffer)
      .resize(size, size, {
        fit: 'cover',
        position: 'center'
      })
      .webp({ quality: 80 })
      .toBuffer();

    return {
      buffer: thumbnailBuffer,
      size: thumbnailBuffer.length
    };
  }

  /**
   * Optimize image for web with target size
   */
  async optimizeForWeb(_imageUrl: string, _targetSize: number): Promise<OptimizedImage> {
    // This method would be used for existing images, not base64 processing
    // For now, we'll implement the core optimization logic
    throw new Error('Method optimizeForWeb not implemented for URLs - use optimizeForSize for buffers');
  }

  /**
   * Optimize image buffer for specific size constraints
   */
  private async optimizeForSize(
    imageBuffer: Buffer, 
    maxWidth: number, 
    maxFileSize: number
  ): Promise<{ buffer: Buffer; size: number }> {
    let quality = 85;
    let optimizedBuffer: Buffer;

    do {
      optimizedBuffer = await sharp(imageBuffer)
        .resize(maxWidth, null, {
          fit: 'inside',
          withoutEnlargement: true
        })
        .webp({ quality })
        .toBuffer();

      if (optimizedBuffer.length <= maxFileSize || quality <= 60) {
        break;
      }

      quality -= 5;
    } while (quality > 60);

    return {
      buffer: optimizedBuffer,
      size: optimizedBuffer.length
    };
  }

  /**
   * Convert image to WebP format
   */
  private async convertToWebP(imageBuffer: Buffer): Promise<{ buffer: Buffer; size: number }> {
    const webpBuffer = await sharp(imageBuffer)
      .webp({ quality: 85 })
      .toBuffer();

    return {
      buffer: webpBuffer,
      size: webpBuffer.length
    };
  }

  /**
   * Convert image to JPEG format (fallback)
   */
  private async convertToJPEG(imageBuffer: Buffer): Promise<{ buffer: Buffer; size: number }> {
    const jpegBuffer = await sharp(imageBuffer)
      .jpeg({ quality: 85, progressive: true })
      .toBuffer();

    return {
      buffer: jpegBuffer,
      size: jpegBuffer.length
    };
  }

  /**
   * Upload processed image to Supabase Storage
   */
  private async uploadToStorage(
    path: string, 
    buffer: Buffer, 
    contentType: string
  ): Promise<string> {
    const { data, error } = await this.supabase.storage
      .from(this.BUCKET_NAME)
      .upload(path, buffer, {
        contentType,
        cacheControl: '31536000', // 1 year cache
        upsert: false
      });

    if (error) {
      console.error('Storage upload error:', error);
      throw new Error(`Failed to upload image: ${error.message}`);
    }

    // Get public URL
    const { data: urlData } = this.supabase.storage
      .from(this.BUCKET_NAME)
      .getPublicUrl(path);

    return urlData.publicUrl;
  }

  /**
   * Delete image and all its variants by image ID
   */
  async deleteImage(imageId: string): Promise<void> {
    try {
      // List all files for this image ID
      const { data: files, error: listError } = await this.supabase.storage
        .from(this.BUCKET_NAME)
        .list(imageId);

      if (listError) {
        console.error('Error listing files for deletion:', listError);
        throw new Error(`Failed to list files: ${listError.message}`);
      }

      if (!files || files.length === 0) {
        console.warn(`No files found for image ID: ${imageId}`);
        return;
      }

      // Delete all files
      const filePaths = files.map(file => `${imageId}/${file.name}`);
      const { error: deleteError } = await this.supabase.storage
        .from(this.BUCKET_NAME)
        .remove(filePaths);

      if (deleteError) {
        console.error('Error deleting files:', deleteError);
        throw new Error(`Failed to delete files: ${deleteError.message}`);
      }

      console.log(`Successfully deleted ${filePaths.length} files for image ${imageId}`);
    } catch (error) {
      console.error('Error in deleteImage:', error);
      throw error;
    }
  }

  /**
   * Delete a single image file from storage by URL
   */
  async deleteImageFromStorage(imageUrl: string): Promise<void> {
    try {
      // Extract the file path from the URL
      const url = new URL(imageUrl);
      const pathParts = url.pathname.split('/');
      
      // Find the bucket name and file path
      // URL format: https://[project].supabase.co/storage/v1/object/public/[bucket]/[path]
      const bucketIndex = pathParts.findIndex(part => part === 'public') + 1;
      if (bucketIndex === 0 || bucketIndex >= pathParts.length) {
        throw new Error('Invalid storage URL format');
      }
      
      const bucket = pathParts[bucketIndex];
      const filePath = pathParts.slice(bucketIndex + 1).join('/');
      
      if (!filePath) {
        throw new Error('Could not extract file path from URL');
      }

      // Delete the file
      const { error } = await this.supabase.storage
        .from(bucket)
        .remove([filePath]);

      if (error) {
        console.error('Error deleting file from storage:', error);
        throw new Error(`Failed to delete file: ${error.message}`);
      }

      console.log(`Successfully deleted file: ${filePath}`);
    } catch (error) {
      console.error('Error in deleteImageFromStorage:', error);
      throw error;
    }
  }

  /**
   * Get image metadata from URL or database
   */
  async getImageMetadata(imageUrl: string): Promise<ImageMetadata | null> {
    try {
      // Extract image ID from URL
      const urlParts = imageUrl.split('/');
      const imageId = urlParts[urlParts.length - 2]; // Assuming format: .../imageId/filename

      // Query database for metadata
      const { data, error } = await this.supabase
        .from('ai_generated_images')
        .select('menu_item_id, generation_job_id, prompt, aspect_ratio, created_at')
        .eq('id', imageId)
        .single();

      if (error || !data) {
        console.warn('No metadata found for image:', imageUrl);
        return null;
      }

      return {
        menuItemId: data.menu_item_id,
        generationJobId: data.generation_job_id,
        originalPrompt: data.prompt,
        aspectRatio: data.aspect_ratio,
        generatedAt: new Date(data.created_at)
      };
    } catch (error) {
      console.error('Error getting image metadata:', error);
      return null;
    }
  }

  /**
   * Store processed image metadata in database
   */
  async storeImageMetadata(processedImage: ProcessedImage): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('ai_generated_images')
        .insert({
          id: processedImage.id,
          menu_item_id: processedImage.metadata.menuItemId,
          generation_job_id: processedImage.metadata.generationJobId,
          original_url: processedImage.originalUrl,
          thumbnail_url: processedImage.thumbnailUrl,
          mobile_url: processedImage.mobileUrl,
          desktop_url: processedImage.desktopUrl,
          webp_url: processedImage.webpUrl,
          prompt: processedImage.metadata.originalPrompt,
          aspect_ratio: processedImage.metadata.aspectRatio,
          file_size: processedImage.sizes.original,
          selected: false,
          metadata: {
            sizes: processedImage.sizes,
            processingTimestamp: Date.now()
          }
        });

      if (error) {
        console.error('Error storing image metadata:', error);
        throw new Error(`Failed to store metadata: ${error.message}`);
      }
    } catch (error) {
      console.error('Error in storeImageMetadata:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const imageProcessingService = new ImageProcessingService();