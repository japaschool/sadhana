## Inspiration
### Api
-  Original [article](https://agmprojects.com/blog/building-a-rest-and-web-socket-api-with-actix.html) with an example how to build a web service with actix-web
- [JWT Auth](https://gill.net.in/posts/auth-microservice-rust-actix-web1.0-diesel-complete-tutorial/#lets-do-auth)
- [Session Based Auth](https://www.lpalmieri.com/posts/session-based-authentication-in-rust/)

### Yew
- Frontend [app](https://github.com/jetli/rust-yew-realworld-example-app) that uses Yew (using hooks!), css and styling. Also has *Tauri* impl. See the backend [here](https://github.com/snamiki1212/realworld-v1-rust-actix-web-diesel)
- [Awesome Yew](https://project-awesome.org/jetli/awesome-yew)

### Styling (CSS)
- [Tailwind](https://github.com/matiu2/tailwind-yew-builder) in rust

### iOS
- How to [make web app look like a native iOS app](https://medium.com/appscope/designing-native-like-progressive-web-apps-for-ios-1b3cdda1d0e8)

## TODO List
### Bugs
- [X] Server needs to send errors in a format UI can understand 

### Features
- [ ] Validate email upon registration #auth
- [ ] Magic link login #auth
- [ ] Update user details #api
- [ ] Delete user #api
- [X] Extract errors.rs from frontend and backend into a separate crate. #tech_debt
- [ ] https support #tech_debt
- [ ] script up spinning up local docker instance for postgres #tech_debt
- [ ] tests #tech_debt
- [ ] refactor frontend to have similar structure to backend #tech_debt
- [ ] validate confirmation on backend when creating a new user. Frontend should send conf id for that.
- [X] choosing practices #feature
- [X] adding custom practices #feature
- [X] automatically add default practices to new users #feature

## Learning Rust
* [Niko Matsakis: What's unique about Rust?](https://www.youtube.com/watch?v=jQOZX0xkrWA)
* [Rust Book](https://doc.rust-lang.org/book/ch00-00-introduction.html)
* [Visualizing memory layout of Rust's data types](https://www.youtube.com/watch?v=rDoqT-a6UFg)
* [Learning rust with too many lists](https://rust-unofficial.github.io/too-many-lists/)

### References
* [Cheat Sheet](https://cheats.rs/#data-structures)
* [Tour of Rust's Standard Library Traits](https://github.com/pretzelhammer/rust-blog/blob/master/posts/tour-of-rusts-standard-library-traits.md)

## Requirements
* https://docs.google.com/spreadsheets/d/1I9TTV_3fZ3saqSjlhVjJG6DWpjnX9H3JqbVDqRuRQGs/edit?usp=sharing
* https://docs.google.com/document/d/1HePTbaFPy5C3XXL8NS0slXRFSQFEKpDrCHvi0Sja4Zk/edit?usp=sharing

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