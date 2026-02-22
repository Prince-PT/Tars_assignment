import { DiscoverUsers } from "@/components/discover-users";

const Home = () => {
  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Community Members
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Discover and connect with other users
          </p>
        </div>
      </div>
      <DiscoverUsers />
    </main>
  );
};

export default Home;
