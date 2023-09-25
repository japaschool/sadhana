## Inspiration

### Api

- Original [article](https://agmprojects.com/blog/building-a-rest-and-web-socket-api-with-actix.html) with an example how to build a web service with actix-web
- [JWT Auth](https://gill.net.in/posts/auth-microservice-rust-actix-web1.0-diesel-complete-tutorial/#lets-do-auth)
- [Session Based Auth](https://www.lpalmieri.com/posts/session-based-authentication-in-rust/)

### Yew

- Frontend [app](https://github.com/jetli/rust-yew-realworld-example-app) that uses Yew (using hooks!), css and styling. Also has _Tauri_ impl. See the backend [here](https://github.com/snamiki1212/realworld-v1-rust-actix-web-diesel)
- [Awesome Yew](https://project-awesome.org/jetli/awesome-yew)

### Styling (CSS)

- [Tailwind](https://github.com/matiu2/tailwind-yew-builder) in rust

### iOS

- How to [make web app look like a native iOS app](https://medium.com/appscope/designing-native-like-progressive-web-apps-for-ios-1b3cdda1d0e8)
- https://samselikoff.com/blog/8-tips-to-make-your-website-feel-like-an-ios-app#tip-5:-make-the-status-bar-transparent

## Learning Rust

- [Niko Matsakis: What's unique about Rust?](https://www.youtube.com/watch?v=jQOZX0xkrWA)
- [Rust Book](https://doc.rust-lang.org/book/ch00-00-introduction.html)
- [Visualizing memory layout of Rust's data types](https://www.youtube.com/watch?v=rDoqT-a6UFg)
- [Learning rust with too many lists](https://rust-unofficial.github.io/too-many-lists/)

### References

- [Cheat Sheet](https://cheats.rs/#data-structures)
- [Tour of Rust's Standard Library Traits](https://github.com/pretzelhammer/rust-blog/blob/master/posts/tour-of-rusts-standard-library-traits.md)

## Requirements

- https://docs.google.com/spreadsheets/d/1I9TTV_3fZ3saqSjlhVjJG6DWpjnX9H3JqbVDqRuRQGs/edit?usp=sharing
- https://docs.google.com/document/d/1HePTbaFPy5C3XXL8NS0slXRFSQFEKpDrCHvi0Sja4Zk/edit?usp=sharing

## Dev

### Running the code

1. Install trunk `cargo install -f trunk`
2. Do `rustup target add wasm32-unknown-unknown`
3. Install diesel_cli:

```
brew install libpq
brew link --force libpq
echo 'export PATH="/usr/local/opt/libpq/bin:$PATH"' >> ~/.zshrc
cargo install diesel_cli --no-default-features --features postgres
```

4. Run: `make run`
5. Open in chrome localhost:8080

### Add a practice to all users

`insert into user_practices (user_id, practice, data_type) select id, 'Rounds, Total', 'int' from users;`

### Docker

To build a container run:
`docker build -t sadhanapro .`

To run the container use the following command as an example:
`docker run -p4242:80 -d --name sadhanapro -t -e 'SERVER_ADDRESS=0.0.0.0:80' -e 'JWT_KEY=xyz' -v "$(pwd)"/env.template:/usr/local/bin/.env sadhanapro`

The required environment variables can be either passed down with `-e` flag or in a mapped `.env` file.

### Splash screen generation for iOS

1. `npm install pwa-asset-generator`
2. Run

```
npx pwa-asset-generator images/logo.png images -m site.webmanifest --padding "calc(50vh - 25%) calc(50vw - 25%)" -b "linear-gradient(135deg, #7c6d63, #2f293b)" -q 100 -i asset-generator-changes.html --favicon
```

### Icons

[Free svg icons](https://heroicons.com/)
[Fix stocks to fills](https://docs.oslllo.com/svg-fixer/master/#/getting-started/cli?id=svgfixer-cli-installation)
[Svg to ttl](https://icomoon.io/app/#/select/font)
Note, you actually need to merge changes to style.css as it includes some important margins.