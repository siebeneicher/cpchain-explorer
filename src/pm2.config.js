module.exports = {
  apps : [{
    name: "sync",
    script: "./sync.js",
    args: "",
    node_args: ["--inspect --inspect-port=9229"],
    instances: 1,
    exec_mode: "cluster",
    max_memory_restart: "400M",
    cwd: './',
    watch: false,
    ignore_watch: ['node_modules','logs','ui-build'],
    watch_options: {
        "followSymlinks": false
    },
    error_file: "./logs/sync.err.log",
    //out_file: "./logs/sync.verbose.log",
    env: {
      NODE_ENV: "production",
    }
  }, {
    name: "aggregate",
    script: "./aggregate.js",
    args: "",
    instances: 1,
    exec_mode: "cluster",
    max_memory_restart: "400M",
    cwd: './',
    watch: false,
    ignore_watch: ['node_modules','logs','ui-build'],
    watch_options: {
        "followSymlinks": false
    },
    error_file: "./logs/aggregate.err.log",
    //out_file: "./logs/aggregate.verbose.log",
    env: {
      NODE_ENV: "production",
    }
  }, {
    name: "worker",
    script: "./worker.js",
    args: "",
    instances: 1,
    exec_mode: "cluster",
    max_memory_restart: "400M",
    cwd: './',
    watch: false,
    ignore_watch: ['node_modules','logs','ui-build'],
    watch_options: {
        "followSymlinks": false
    },
    error_file: "./logs/worker.err.log",
    //out_file: "./logs/worker.verbose.log",
    env: {
      NODE_ENV: "production",
    }
  }]
}