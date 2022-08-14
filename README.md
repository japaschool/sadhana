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

### TODO List
#### Bugs
- [ ] Server needs to send errors in a format UI can understand 

#### Features
- [ ] Extract errors.rs from frontend and backend into a separate crate.
- [ ] https support
- [ ] script up spinning up local docker instance for postgres