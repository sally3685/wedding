export default function Loading() {
  return (
    <div className="w-full items-center min-h-actualHeight   bg-linear-to-l gap-4 flex flex-col justify-center from-kadroDarkBrown/50 to-kadroCaramel/50 p-8 ">
      <div className="h-8 w-1/3 rounded bg-kadroBeige animate-pulse" />
      <div className="h-64 w-full rounded bg-kadroBeige animate-pulse" />
      <div className="h-4 w-2/3 rounded bg-kadroBeige animate-pulse" />
      <div className="h-4 w-1/2 rounded bg-kadroBeige animate-pulse" />
    </div>
  );
}
