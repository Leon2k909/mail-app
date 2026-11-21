# Mail Preview for Windows

A Rust and GPUI prototype of the three-pane Mail app. Try the folders, message search, unread filter, and reading pane. You can also move sample messages between folders and toggle their read status. The sample mailbox resets when you quit.

Press **Ctrl+F** to search the current folder, **Esc** to return to the message list, and **Up** or **Down** to open a message from the list.

## Run

Use Rust stable with the Windows MSVC toolchain and the Visual C++ build tools.

```powershell
cargo run --release --locked --manifest-path native/Cargo.toml
```

The preview uses sample mail and has no account setup, live IMAP/SMTP, or auto-updater. It does not read or write the installed Mail app's profile.

## Test

```powershell
cargo test --locked --manifest-path native/Cargo.toml
```

The headless GPUI tests exercise keyboard search, unread filtering, folder actions, and the empty mailbox at the minimum window size.

## Measure

Pass the path to the original unpacked Electron 1.2.0 executable. The script opens each release build once to warm up, then measures an empty mailbox in both apps. It reports the median time to a titled main window, total private working set after a short idle, process count, and unpacked disk footprint. Use a separate unpacked Electron build because the benchmark closes both apps between runs.

```powershell
cargo build --release --locked --manifest-path native/Cargo.toml
pwsh -NoProfile -File native/benchmark.ps1 -ElectronExe 'C:\path\to\win-unpacked\Mail.exe'
```

The benchmark isolates the Electron profile and suppresses DNS for that session. It measures shell startup and idle memory, with mail sync and network performance outside its scope.

Pass `-PreviousNativeExe` to include an earlier Rust build in the same run. The launch order rotates on each pass.

### Windows preview results

Medians from five runs per build on an Intel Core i7-11700K PC. All three builds ran in the same session with an empty mailbox after one warm-up launch.

| Metric | Electron 1.2.0 | Previous Rust preview | Rust preview with GPUI Kit |
| --- | ---: | ---: | ---: |
| Time to a titled window | 575 ms | 694 ms | 635 ms |
| Idle private working set | 98.6 MiB | 17.4 MiB | 15.2 MiB |
| Processes | 4 | 1 | 1 |
| Unpacked app files | 364.8 MiB | 18.5 MiB | 23.6 MiB |

The updated preview uses GPUI Kit 0.10.0, whose Windows backend keeps the Direct3D device created during adapter selection. [Upstream GPUI change](https://github.com/zed-industries/zed/pull/49001)
