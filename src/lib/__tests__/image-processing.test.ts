import { ImageProcessingService } from '../image-processing';
import sharp from 'sharp';
import { createClient } from '@supabase/supabase-js';
// Jest provides `describe`, `it`, and lifecycle hooks as globals

// Mock Sharp
jest.mock('sharp');
const mockSharp = sharp as jest.MockedFunction<typeof sharp>;

// Mock Supabase
jest.mock('@supabase/supabase-js');
const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;

// Mock crypto.randomUUID
Object.defineProperty(global, 'crypto', {
  value: {
    randomUUID: jest.fn(() => 'test-uuid-123')
  }
});

describe('ImageProcessingService', () => {
  let imageProcessingService: ImageProcessingService;
  let mockSupabase: any;
  let mockSharpInstance: any;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Mock Supabase client
    mockSupabase = {
      storage: {
        from: jest.fn().mockReturnThis(),
        upload: jest.fn(),
        getPublicUrl: jest.fn(),
        list: jest.fn(),
        remove: jest.fn()
      },
      from: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn()
    };

    mockCreateClient.mockReturnValue(mockSupabase);

    // Mock Sharp instance
    mockSharpInstance = {
      metadata: jest.fn(),
      resize: jest.fn().mockReturnThis(),
      webp: jest.fn().mockReturnThis(),
      jpeg: jest.fn().mockReturnThis(),
      toBuffer: jest.fn()
    };

    mockSharp.mockReturnValue(mockSharpInstance);

    imageProcessingService = new ImageProcessingService(mockSupabase);
  });

  describe('processGeneratedImage', () => {
    const mockBase64Data = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
    const mockMetadata = {
      menuItemId: 'menu-item-123',
      generationJobId: 'job-123',
      originalPrompt: 'A delicious burger',
      aspectRatio: '1:1',
      generatedAt: new Date('2024-01-01T00:00:00Z')
    };
    const mockUserId = 'user-123';

    beforeEach(() => {
      // Mock Sharp metadata
      mockSharpInstance.metadata.mockResolvedValue({
        width: 1024,
        height: 1024,
        format: 'jpeg'
      });

      // Mock Sharp toBuffer for different operations
      mockSharpInstance.toBuffer
        .mockResolvedValueOnce(Buffer.from('thumbnail-data')) // thumbnail
        .mockResolvedValueOnce(Buffer.from('mobile-data'))    // mobile
        .mockResolvedValueOnce(Buffer.from('desktop-data'))   // desktop
        .mockResolvedValueOnce(Buffer.from('webp-data'))      // webp
        .mockResolvedValueOnce(Buffer.from('jpeg-data'));     // jpeg

      // Mock Supabase storage upload
      mockSupabase.storage.upload.mockResolvedValue({
        data: { path: 'test-path' },
        error: null
      });

      // Mock Supabase getPublicUrl
      mockSupabase.storage.getPublicUrl.mockReturnValue({
        data: { publicUrl: 'https://example.com/test-url' }
      });

      // Mock database insert
      mockSupabase.insert.mockResolvedValue({
        data: null,
        error: null
      });
    });

    it('should process base64 image and generate all required versions', async () => {
      const result = await imageProcessingService.processGeneratedImage(
        mockBase64Data,
        mockMetadata,
        mockUserId
      );

      expect(result).toEqual({
        id: 'test-uuid-123',
        originalUrl: 'https://example.com/test-url',
        thumbnailUrl: 'https://example.com/test-url',
        mobileUrl: 'https://example.com/test-url',
        desktopUrl: 'https://example.com/test-url',
        webpUrl: 'https://example.com/test-url',
        jpegUrl: 'https://example.com/test-url',
        metadata: mockMetadata,
        sizes: {
          original: expect.any(Number),
          thumbnail: 14, // Length of 'thumbnail-data'
          mobile: 11,    // Length of 'mobile-data'
          desktop: 12    // Length of 'desktop-data'
        }
      });
    });

    it('should decode base64 image correctly', async () => {
      await imageProcessingService.processGeneratedImage(
        mockBase64Data,
        mockMetadata,
        mockUserId
      );

      // Verify Sharp was called with decoded buffer
      expect(mockSharp).toHaveBeenCalledWith(expect.any(Buffer));
      
      // Verify the buffer contains the decoded base64 data
      const calledBuffer = mockSharp.mock.calls[0][0];
      expect(calledBuffer).toBeInstanceOf(Buffer);
    });

    it('should generate thumbnail with correct dimensions', async () => {
      await imageProcessingService.processGeneratedImage(
        mockBase64Data,
        mockMetadata,
        mockUserId
      );

      // Verify thumbnail generation
      expect(mockSharpInstance.resize).toHaveBeenCalledWith(150, 150, {
        fit: 'cover',
        position: 'center'
      });
      expect(mockSharpInstance.webp).toHaveBeenCalledWith({ quality: 80 });
    });

    it('should upload files with user-specific paths', async () => {
      await imageProcessingService.processGeneratedImage(
        mockBase64Data,
        mockMetadata,
        mockUserId
      );

      // Verify uploads were called with correct paths
      expect(mockSupabase.storage.upload).toHaveBeenCalledTimes(6);
      
      const uploadCalls = mockSupabase.storage.upload.mock.calls;
      uploadCalls.forEach((call: any) => {
        const path = call[0];
        expect(path).toMatch(/^user-123\/test-uuid-123\//);
      });
    });

    it('should handle upload errors gracefully', async () => {
      mockSupabase.storage.upload.mockResolvedValueOnce({
        data: null,
        error: { message: 'Upload failed' }
      });

      await expect(
        imageProcessingService.processGeneratedImage(
          mockBase64Data,
          mockMetadata,
          mockUserId
        )
      ).rejects.toThrow('Failed to upload image: Upload failed');
    });
  });

  describe('generateThumbnail', () => {
    it('should generate thumbnail with correct size and quality', async () => {
      const mockBuffer = Buffer.from('test-image-data');
      mockSharpInstance.toBuffer.mockResolvedValue(Buffer.from('thumbnail-result'));

      const result = await imageProcessingService.generateThumbnail(mockBuffer, 200);

      expect(mockSharpInstance.resize).toHaveBeenCalledWith(200, 200, {
        fit: 'cover',
        position: 'center'
      });
      expect(mockSharpInstance.webp).toHaveBeenCalledWith({ quality: 80 });
      expect(result).toEqual({
        buffer: Buffer.from('thumbnail-result'),
        size: 16 // Length of 'thumbnail-result'
      });
    });
  });

  describe('deleteImage', () => {
    it('should delete all files for an image ID', async () => {
      const imageId = 'test-image-123';
      
      // Mock file listing
      mockSupabase.storage.list.mockResolvedValue({
        data: [
          { name: 'original_123.jpg' },
          { name: 'thumbnail_123.webp' },
          { name: 'mobile_123.webp' }
        ],
        error: null
      });

      // Mock file removal
      mockSupabase.storage.remove.mockResolvedValue({
        data: null,
        error: null
      });

      await imageProcessingService.deleteImage(imageId);

      expect(mockSupabase.storage.list).toHaveBeenCalledWith(imageId);
      expect(mockSupabase.storage.remove).toHaveBeenCalledWith([
        'test-image-123/original_123.jpg',
        'test-image-123/thumbnail_123.webp',
        'test-image-123/mobile_123.webp'
      ]);
    });

    it('should handle case when no files exist', async () => {
      const imageId = 'non-existent-image';
      
      mockSupabase.storage.list.mockResolvedValue({
        data: [],
        error: null
      });

      // Should not throw error
      await expect(
        imageProcessingService.deleteImage(imageId)
      ).resolves.not.toThrow();

      expect(mockSupabase.storage.remove).not.toHaveBeenCalled();
    });

    it('should handle list errors', async () => {
      const imageId = 'test-image-123';
      
      mockSupabase.storage.list.mockResolvedValue({
        data: null,
        error: { message: 'List failed' }
      });

      await expect(
        imageProcessingService.deleteImage(imageId)
      ).rejects.toThrow('Failed to list files: List failed');
    });
  });

  describe('getImageMetadata', () => {
    it('should extract image ID from URL and fetch metadata', async () => {
      const imageUrl = 'https://example.com/storage/ai-generated-images/user-123/image-456/original.jpg';
      
      mockSupabase.single.mockResolvedValue({
        data: {
          menu_item_id: 'menu-123',
          generation_job_id: 'job-456',
          prompt: 'Test prompt',
          aspect_ratio: '16:9',
          created_at: '2024-01-01T00:00:00Z'
        },
        error: null
      });

      const result = await imageProcessingService.getImageMetadata(imageUrl);

      expect(result).toEqual({
        menuItemId: 'menu-123',
        generationJobId: 'job-456',
        originalPrompt: 'Test prompt',
        aspectRatio: '16:9',
        generatedAt: new Date('2024-01-01T00:00:00Z')
      });
    });

    it('should return null when metadata not found', async () => {
      const imageUrl = 'https://example.com/storage/ai-generated-images/user-123/image-456/original.jpg';
      
      mockSupabase.single.mockResolvedValue({
        data: null,
        error: { message: 'Not found' }
      });

      const result = await imageProcessingService.getImageMetadata(imageUrl);

      expect(result).toBeNull();
    });
  });

  describe('storeImageMetadata', () => {
    it('should store processed image metadata in database', async () => {
      const processedImage = {
        id: 'image-123',
        originalUrl: 'https://example.com/original.jpg',
        thumbnailUrl: 'https://example.com/thumb.webp',
        mobileUrl: 'https://example.com/mobile.webp',
        desktopUrl: 'https://example.com/desktop.webp',
        webpUrl: 'https://example.com/image.webp',
        jpegUrl: 'https://example.com/image.jpg',
        metadata: {
          menuItemId: 'menu-123',
          generationJobId: 'job-456',
          originalPrompt: 'Test prompt',
          aspectRatio: '1:1',
          generatedAt: new Date('2024-01-01T00:00:00Z')
        },
        sizes: {
          original: 1024000,
          thumbnail: 5120,
          mobile: 51200,
          desktop: 204800
        }
      };

      mockSupabase.insert.mockResolvedValue({
        data: null,
        error: null
      });

      await imageProcessingService.storeImageMetadata(processedImage);

      expect(mockSupabase.from).toHaveBeenCalledWith('ai_generated_images');
      expect(mockSupabase.insert).toHaveBeenCalledWith({
        id: 'image-123',
        menu_item_id: 'menu-123',
        generation_job_id: 'job-456',
        original_url: 'https://example.com/original.jpg',
        thumbnail_url: 'https://example.com/thumb.webp',
        mobile_url: 'https://example.com/mobile.webp',
        desktop_url: 'https://example.com/desktop.webp',
        webp_url: 'https://example.com/image.webp',
        prompt: 'Test prompt',
        aspect_ratio: '1:1',
        file_size: 1024000,
        selected: false,
        metadata: {
          sizes: processedImage.sizes,
          processingTimestamp: expect.any(Number)
        }
      });
    });

    it('should handle database errors', async () => {
      const processedImage = {
        id: 'image-123',
        metadata: {
          menuItemId: 'menu-123',
          generationJobId: 'job-456',
          originalPrompt: 'Test prompt',
          aspectRatio: '1:1',
          generatedAt: new Date()
        },
        sizes: { original: 1024, thumbnail: 512, mobile: 256, desktop: 1024 }
      } as any;

      mockSupabase.insert.mockResolvedValue({
        data: null,
        error: { message: 'Database error' }
      });

      await expect(
        imageProcessingService.storeImageMetadata(processedImage)
      ).rejects.toThrow('Failed to store metadata: Database error');
    });
  });

  describe('Image optimization', () => {
    it('should optimize images within file size constraints', async () => {
      const mockBuffer = Buffer.from('large-image-data');
      
      // Mock multiple quality attempts
      mockSharpInstance.toBuffer
        .mockResolvedValueOnce(Buffer.alloc(300000)) // First attempt: too large
        .mockResolvedValueOnce(Buffer.alloc(180000)); // Second attempt: within limit

      // Access private method through any cast for testing
      const service = imageProcessingService as any;
      const result = await service.optimizeForSize(mockBuffer, 800, 200000);

      expect(result.size).toBeLessThanOrEqual(200000);
      expect(mockSharpInstance.webp).toHaveBeenCalledTimes(2);
      expect(mockSharpInstance.webp).toHaveBeenCalledWith({ quality: 85 });
      expect(mockSharpInstance.webp).toHaveBeenCalledWith({ quality: 80 });
    });

    it('should convert images to WebP format', async () => {
      const mockBuffer = Buffer.from('image-data');
      mockSharpInstance.toBuffer.mockResolvedValue(Buffer.from('webp-result'));

      const service = imageProcessingService as any;
      const result = await service.convertToWebP(mockBuffer);

      expect(mockSharpInstance.webp).toHaveBeenCalledWith({ quality: 85 });
      expect(result).toEqual({
        buffer: Buffer.from('webp-result'),
        size: 11 // Length of 'webp-result'
      });
    });

    it('should convert images to JPEG format with progressive encoding', async () => {
      const mockBuffer = Buffer.from('image-data');
      mockSharpInstance.toBuffer.mockResolvedValue(Buffer.from('jpeg-result'));

      const service = imageProcessingService as any;
      const result = await service.convertToJPEG(mockBuffer);

      expect(mockSharpInstance.jpeg).toHaveBeenCalledWith({ 
        quality: 85, 
        progressive: true 
      });
      expect(result).toEqual({
        buffer: Buffer.from('jpeg-result'),
        size: 11 // Length of 'jpeg-result'
      });
    });
  });
});