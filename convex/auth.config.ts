const domain = process.env.CLERK_ISSUER_DOMAIN;
if (!domain) throw new Error("Missing CLERK_ISSUER_DOMAIN env var");

export default {
  providers: [
    {
      domain,
      applicationID: "convex",
    },
  ],
};
