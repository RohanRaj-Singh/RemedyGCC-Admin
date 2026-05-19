module.exports = {
  apps: [
    {
      name: "remedy-admin",
      script: "npm",
      args: "start",
      cwd: "/var/www/remedygcc/admin",
      env: {
        PORT: 3001,
        MONGODB_URI:
          "mongodb://remedygcc_app:RemedyGCC%402026@127.0.0.1:27017/remedygcc?authSource=remedygcc",
      },
    },
  ],
};
