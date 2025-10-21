"use client"

import { useState, useCallback } from "react"
import { useDropzone } from "react-dropzone"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { uploadFile } from "@/lib/mock/s3"
import { extractFromDocument } from "@/lib/mock/ai"
import { Upload, File, X, Download, Loader2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import type { Company } from "@/types/auth"
import type { AIExtractionResult } from "@/lib/mock/ai"

interface FileUploadProps {
  company: Company
  onExtractionComplete?: (data: AIExtractionResult) => void
  onFileUploaded?: (url: string) => void
}

interface UploadedFile {
  file: File
  url?: string
  extractedData?: AIExtractionResult
  isUploading: boolean
  isExtracting: boolean
  uploadProgress: number
}

export function FileUpload({ company, onExtractionComplete, onFileUploaded }: FileUploadProps) {
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([])
  const { toast } = useToast()

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      const newFiles: UploadedFile[] = acceptedFiles.map((file) => ({
        file,
        isUploading: true,
        isExtracting: false,
        uploadProgress: 0,
      }))

      setUploadedFiles((prev) => [...prev, ...newFiles])

      // Process each file
      for (let i = 0; i < newFiles.length; i++) {
        const fileIndex = uploadedFiles.length + i

        try {
          // Simulate upload progress
          const progressInterval = setInterval(() => {
            setUploadedFiles((prev) =>
              prev.map((f, idx) =>
                idx === fileIndex ? { ...f, uploadProgress: Math.min(f.uploadProgress + 10, 90) } : f,
              ),
            )
          }, 100)

          // Upload file
          const uploadResult = await uploadFile(newFiles[i].file)
          clearInterval(progressInterval)

          setUploadedFiles((prev) =>
            prev.map((f, idx) =>
              idx === fileIndex
                ? { ...f, url: uploadResult.url, isUploading: false, uploadProgress: 100, isExtracting: true }
                : f,
            ),
          )

          onFileUploaded?.(uploadResult.url)

          // Extract data with AI
          const extractedData = await extractFromDocument(uploadResult.url, company)

          setUploadedFiles((prev) =>
            prev.map((f, idx) => (idx === fileIndex ? { ...f, extractedData, isExtracting: false } : f)),
          )

          onExtractionComplete?.(extractedData)

          toast({
            title: "File processed successfully",
            description: `Extracted data from ${newFiles[i].file.name} with ${extractedData.confidence} confidence`,
          })
        } catch (error) {
          setUploadedFiles((prev) =>
            prev.map((f, idx) => (idx === fileIndex ? { ...f, isUploading: false, isExtracting: false } : f)),
          )

          toast({
            title: "Upload failed",
            description: `Failed to process ${newFiles[i].file.name}`,
            variant: "destructive",
          })
        }
      }
    },
    [company, onExtractionComplete, onFileUploaded, toast, uploadedFiles.length],
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/pdf": [".pdf"],
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
      "application/vnd.ms-excel": [".xls"],
      "text/csv": [".csv"],
      "text/plain": [".txt"],
      "image/jpeg": [".jpg", ".jpeg"],
      "image/png": [".png"],
    },
    maxSize: 10 * 1024 * 1024, // 10MB
  })

  const removeFile = (index: number) => {
    setUploadedFiles((prev) => prev.filter((_, i) => i !== index))
  }

  return (
    <div className="space-y-4">
      {/* Drop Zone */}
      <Card>
        <CardContent className="p-6">
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
              isDragActive ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50"
            }`}
          >
            <input {...getInputProps()} />
            <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            {isDragActive ? (
              <p className="text-lg font-medium">Drop files here...</p>
            ) : (
              <div>
                <p className="text-lg font-medium mb-2">Drag & drop files here, or click to select</p>
                <p className="text-sm text-muted-foreground mb-4">Supports PDF, Excel, CSV, TXT, JPG, PNG (max 10MB)</p>
                <Button type="button" variant="outline">Choose Files</Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Uploaded Files */}
      {uploadedFiles.length > 0 && (
        <div className="space-y-3">
          <h4 className="font-medium">Uploaded Files</h4>
          {uploadedFiles.map((uploadedFile, index) => (
            <Card key={index}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3 flex-1">
                    <File className="h-8 w-8 text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{uploadedFile.file.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {(uploadedFile.file.size / 1024 / 1024).toFixed(2)} MB
                      </p>

                      {uploadedFile.isUploading && (
                        <div className="mt-2">
                          <Progress value={uploadedFile.uploadProgress} className="h-2" />
                          <p className="text-xs text-muted-foreground mt-1">
                            Uploading... {uploadedFile.uploadProgress}%
                          </p>
                        </div>
                      )}

                      {uploadedFile.isExtracting && (
                        <div className="flex items-center space-x-2 mt-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <p className="text-xs text-muted-foreground">Extracting data with AI...</p>
                        </div>
                      )}

                      {uploadedFile.extractedData && (
                        <div className="flex items-center space-x-2 mt-2">
                          <Badge variant="secondary">AI Extracted ({uploadedFile.extractedData.confidence})</Badge>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    {uploadedFile.url && (
                      <Button type="button" variant="ghost" size="sm">
                        <Download className="h-4 w-4" />
                      </Button>
                    )}
                    <Button type="button" variant="ghost" size="sm" onClick={() => removeFile(index)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
