import Link from 'next/link';
import { Map, Leaf, Clock, Inbox } from 'lucide-react';

export default function Home() {
  return (
    <div className="min-h-screen bg-neutral-950 text-white flex items-center justify-center">
      <div className="max-w-2xl mx-auto px-4 py-12 text-center">
        <h1 className="text-4xl font-bold mb-4">Terra Memoria</h1>
        <p className="text-neutral-400 mb-8">
          Your garden knowledge base and planning tool
        </p>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Link
            href="/planner"
            className="flex flex-col items-center gap-3 p-6 bg-neutral-900 border border-neutral-800 rounded-xl hover:border-emerald-500 transition-colors"
          >
            <Map className="w-8 h-8 text-emerald-400" />
            <div>
              <h2 className="font-semibold">Garden Planner</h2>
              <p className="text-sm text-neutral-400">Map and plan your garden</p>
            </div>
          </Link>

          <Link
            href="/inventory"
            className="flex flex-col items-center gap-3 p-6 bg-neutral-900 border border-neutral-800 rounded-xl hover:border-emerald-500 transition-colors"
          >
            <Leaf className="w-8 h-8 text-emerald-400" />
            <div>
              <h2 className="font-semibold">Inventory</h2>
              <p className="text-sm text-neutral-400">Track your plants</p>
            </div>
          </Link>

          <Link
            href="/timeline"
            className="flex flex-col items-center gap-3 p-6 bg-neutral-900 border border-neutral-800 rounded-xl hover:border-emerald-500 transition-colors"
          >
            <Clock className="w-8 h-8 text-emerald-400" />
            <div>
              <h2 className="font-semibold">Timeline</h2>
              <p className="text-sm text-neutral-400">Historical views</p>
            </div>
          </Link>

          <Link
            href="/dropbox"
            className="flex flex-col items-center gap-3 p-6 bg-neutral-900 border border-neutral-800 rounded-xl hover:border-emerald-500 transition-colors"
          >
            <Inbox className="w-8 h-8 text-emerald-400" />
            <div>
              <h2 className="font-semibold">Photo Dropbox</h2>
              <p className="text-sm text-neutral-400">Upload & assign photos</p>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
