import UploadFaceImage from '@/components/UploadFaceImage';

export default function Profile() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-100 via-white to-blue-50">
      <div className="bg-white/80 backdrop-blur-sm shadow-2xl rounded-2xl p-8 w-full max-w-md border border-blue-100">
        <h2 className="text-3xl font-bold mb-6 text-center bg-gradient-to-r from-blue-600 to-blue-800 bg-clip-text text-transparent">Face Registration</h2>
        <UploadFaceImage />
      </div>
    </div>
  );
}
