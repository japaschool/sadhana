fn main() {
    let args: Vec<String> = std::env::args().collect();
    let password = args.get(1).map(|s| s.as_str()).unwrap_or("Sadhana123!");
    let hash = bcrypt::hash(password, bcrypt::DEFAULT_COST).unwrap();
    println!("{}", hash);
    // Also verify the python-generated hash
    let py_hash = "$2b$12$rwjEDO8OIJMk.Z8XKYvn1ukZt8xmWFh1xZyjsLV1br1ztaUF1DSg6";
    let ok = bcrypt::verify(password, py_hash).unwrap_or(false);
    println!("Python hash verifies: {}", ok);
}
