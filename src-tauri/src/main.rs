// Sin consola en las builds de release de Windows
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    opsis_lib::run()
}
