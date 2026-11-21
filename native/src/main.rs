#![cfg_attr(target_os = "windows", windows_subsystem = "windows")]

mod icons;
mod mailbox;

#[cfg(test)]
mod tests;

use gpui::{
    App, AppContext, Application, Bounds, Context, Div, Entity, FocusHandle, FontWeight,
    KeyBinding, SharedString, Stateful, Subscription, Window, WindowBounds, WindowOptions, actions,
    div, prelude::*, px, rgb, size, svg,
};
use gpui_component::{
    Root, Theme, ThemeMode,
    input::{Input, InputEvent, InputState},
};
use mailbox::{Folder, Message};

const INK: u32 = 0x191c22;
const MUTED: u32 = 0x535e6d;
const BORDER: u32 = 0xe1e5eb;
const SIDEBAR: u32 = 0xf6f7f9;
const PAPER: u32 = 0xffffff;
const HOVER: u32 = 0xf0f3f8;
const PICKED: u32 = 0xeaf0fc;
const ACCENT: u32 = 0x2d5296;

actions!(
    mail,
    [FocusSearch, NextMessage, PreviousMessage, ReturnToList]
);

struct Mail {
    folder: Folder,
    messages: Vec<Message>,
    selected: Option<usize>,
    unread_only: bool,
    search: Entity<InputState>,
    focus: FocusHandle,
    _search_updates: Subscription,
}

impl Mail {
    fn new(empty: bool, window: &mut Window, cx: &mut Context<Self>) -> Self {
        let search = cx.new(|cx| InputState::new(window, cx).placeholder("Search this folder"));
        let updates = cx.subscribe(&search, |_, _, event: &InputEvent, cx| {
            if matches!(event, InputEvent::Change) {
                cx.notify();
            }
        });
        let focus = cx.focus_handle();
        focus.focus(window);
        Self {
            folder: Folder::Inbox,
            messages: if empty {
                Vec::new()
            } else {
                mailbox::samples()
            },
            selected: (!empty).then_some(0),
            unread_only: false,
            search,
            focus,
            _search_updates: updates,
        }
    }

    fn ids_in_view(&self, cx: &App) -> Vec<usize> {
        let search = self.search.read(cx).value();
        let query = search.trim().to_lowercase();
        self.messages
            .iter()
            .enumerate()
            .filter(|(_, message)| {
                message.folder == self.folder
                    && (!self.unread_only || message.unread)
                    && message.matches(&query)
            })
            .map(|(id, _)| id)
            .collect()
    }

    fn open_message(&mut self, id: usize, cx: &mut Context<Self>) {
        self.selected = Some(id);
        self.messages[id].unread = false;
        cx.notify();
    }

    fn select_folder(&mut self, folder: Folder, window: &mut Window, cx: &mut Context<Self>) {
        self.folder = folder;
        self.selected = None;
        self.unread_only = false;
        self.search
            .update(cx, |search, cx| search.set_value("", window, cx));
        self.focus.focus(window);
        cx.notify();
    }

    fn step_selection(&mut self, step: i32, cx: &mut Context<Self>) {
        let ids = self.ids_in_view(cx);
        let Some(&first) = ids.first() else { return };
        let id = self
            .selected
            .and_then(|selected| ids.iter().position(|&id| id == selected))
            .map(|index| (index as i32 + step).clamp(0, ids.len() as i32 - 1) as usize)
            .map_or(first, |index| ids[index]);
        self.open_message(id, cx);
    }

    fn render_sidebar(&self, cx: &mut Context<Self>) -> impl IntoElement {
        let inbox_unread = self
            .messages
            .iter()
            .filter(|message| message.folder == Folder::Inbox && message.unread)
            .count();
        div()
            .flex()
            .flex_col()
            .w(px(202.))
            .flex_shrink_0()
            .bg(rgb(SIDEBAR))
            .border_r_1()
            .border_color(rgb(BORDER))
            .child(
                div()
                    .flex()
                    .h(px(69.))
                    .items_center()
                    .gap_2()
                    .px_4()
                    .child(
                        div()
                            .flex()
                            .items_center()
                            .justify_center()
                            .rounded_md()
                            .size(px(30.))
                            .bg(rgb(INK))
                            .child(icon("mail", PAPER, 19.)),
                    )
                    .child(
                        div()
                            .font_weight(FontWeight::SEMIBOLD)
                            .text_lg()
                            .child("Mail"),
                    ),
            )
            .child(
                div()
                    .flex()
                    .flex_col()
                    .gap_1()
                    .px_3()
                    .children(Folder::ALL.into_iter().map(|folder| {
                        let selected = self.folder == folder;
                        let color = if selected { ACCENT } else { INK };
                        let count = (folder == Folder::Inbox && inbox_unread > 0)
                            .then(|| inbox_unread.to_string());
                        div()
                            .id(("folder", folder as usize))
                            .debug_selector(|| format!("folder-{}", folder.title()))
                            .flex()
                            .items_center()
                            .gap_3()
                            .h(px(37.))
                            .px_3()
                            .rounded_md()
                            .cursor_pointer()
                            .text_color(rgb(color))
                            .when(selected, |row| {
                                row.bg(rgb(PICKED)).font_weight(FontWeight::SEMIBOLD)
                            })
                            .when(!selected, |row| row.hover(|row| row.bg(rgb(HOVER))))
                            .child(icon(
                                folder.icon(),
                                if selected { ACCENT } else { MUTED },
                                17.,
                            ))
                            .child(div().flex_1().child(folder.title()))
                            .children(count.map(|count| {
                                div()
                                    .text_xs()
                                    .font_weight(FontWeight::SEMIBOLD)
                                    .child(count)
                            }))
                            .on_click(cx.listener(move |this, _, window, cx| {
                                this.select_folder(folder, window, cx)
                            }))
                    })),
            )
            .child(div().flex_1())
            .child(
                div()
                    .border_t_1()
                    .border_color(rgb(BORDER))
                    .p_4()
                    .text_xs()
                    .text_color(rgb(MUTED))
                    .child("Local preview · Sample mail"),
            )
    }

    fn render_list(&self, ids: Vec<usize>, cx: &mut Context<Self>) -> impl IntoElement {
        let filtered = self.unread_only || !self.search.read(cx).value().trim().is_empty();
        div()
            .flex()
            .flex_col()
            .w(px(364.))
            .flex_shrink_0()
            .min_h_0()
            .bg(rgb(PAPER))
            .border_r_1()
            .border_color(rgb(BORDER))
            .child(
                div()
                    .flex()
                    .flex_col()
                    .gap_3()
                    .px_4()
                    .pt_4()
                    .pb_3()
                    .border_b_1()
                    .border_color(rgb(BORDER))
                    .child(
                        div()
                            .flex()
                            .justify_between()
                            .items_center()
                            .gap_2()
                            .child(
                                div()
                                    .text_size(px(23.))
                                    .font_weight(FontWeight::SEMIBOLD)
                                    .child(self.folder.title()),
                            )
                            .child(
                                div()
                                    .flex()
                                    .gap_1()
                                    .rounded_md()
                                    .p_1()
                                    .bg(rgb(SIDEBAR))
                                    .children([false, true].map(|unread| {
                                        let selected = self.unread_only == unread;
                                        let label = if unread { "Unread" } else { "All mail" };
                                        div()
                                            .id(label)
                                            .debug_selector(|| label.into())
                                            .px_2()
                                            .py_1()
                                            .rounded_sm()
                                            .text_xs()
                                            .cursor_pointer()
                                            .text_color(rgb(if selected { INK } else { MUTED }))
                                            .when(selected, |tab| {
                                                tab.bg(rgb(PAPER)).font_weight(FontWeight::SEMIBOLD)
                                            })
                                            .when(!selected, |tab| {
                                                tab.hover(|tab| tab.bg(rgb(HOVER)))
                                            })
                                            .child(label)
                                            .on_click(cx.listener(move |this, _, window, cx| {
                                                this.unread_only = unread;
                                                this.selected = None;
                                                this.focus.focus(window);
                                                cx.notify();
                                            }))
                                    })),
                            ),
                    )
                    .child(Input::new(&self.search).prefix(icon("search", MUTED, 16.))),
            )
            .child(
                div()
                    .id("message-list")
                    .flex_1()
                    .min_h_0()
                    .overflow_y_scroll()
                    .when(ids.is_empty(), |list| {
                        list.child(div().p_6().text_color(rgb(MUTED)).child(if filtered {
                            "No matching messages"
                        } else {
                            "No messages"
                        }))
                    })
                    .children(ids.into_iter().map(|id| self.render_row(id, cx))),
            )
    }

    fn render_row(&self, id: usize, cx: &mut Context<Self>) -> Stateful<Div> {
        let message = &self.messages[id];
        let selected = self.selected == Some(id);
        div()
            .id(("message", id))
            .debug_selector(|| format!("message-{id}"))
            .flex()
            .flex_col()
            .gap_1()
            .px_4()
            .py_3()
            .border_b_1()
            .border_color(rgb(BORDER))
            .cursor_pointer()
            .when(selected, |row| row.bg(rgb(PICKED)))
            .when(!selected, |row| row.hover(|row| row.bg(rgb(HOVER))))
            .child(
                div()
                    .flex()
                    .items_center()
                    .gap_2()
                    .min_w_0()
                    .child(
                        div()
                            .size(px(6.))
                            .flex_shrink_0()
                            .rounded_full()
                            .when(message.unread, |dot| dot.bg(rgb(ACCENT))),
                    )
                    .child(
                        div()
                            .flex_1()
                            .min_w_0()
                            .truncate()
                            .font_weight(FontWeight::SEMIBOLD)
                            .child(message.sender),
                    )
                    .child(
                        div()
                            .text_xs()
                            .flex_shrink_0()
                            .text_color(rgb(MUTED))
                            .child(message.date),
                    ),
            )
            .child(
                div()
                    .pl(px(14.))
                    .truncate()
                    .text_size(px(13.))
                    .when(message.unread, |subject| {
                        subject.font_weight(FontWeight::SEMIBOLD)
                    })
                    .child(message.subject),
            )
            .child(
                div()
                    .pl(px(14.))
                    .truncate()
                    .text_xs()
                    .text_color(rgb(MUTED))
                    .child(message.preview),
            )
            .on_click(cx.listener(move |this, _, window, cx| {
                this.focus.focus(window);
                this.open_message(id, cx);
            }))
    }

    fn render_reader(&self, cx: &mut Context<Self>) -> impl IntoElement {
        let Some(id) = self.selected else {
            return div()
                .flex_1()
                .min_w_0()
                .flex()
                .flex_col()
                .items_center()
                .justify_center()
                .gap_3()
                .child(icon("mail", MUTED, 26.))
                .child(div().text_color(rgb(MUTED)).child("No message selected"));
        };
        let message = &self.messages[id];
        let (initials, background, foreground) = message.avatar;
        let destinations: &[(Folder, &str, &str)] = if message.folder == Folder::Inbox {
            &[
                (Folder::Archive, "Archive", "archive"),
                (Folder::Junk, "Junk", "shield"),
                (Folder::Trash, "Trash", "trash"),
            ]
        } else {
            &[(Folder::Inbox, "Move to inbox", "reply")]
        };
        div()
            .flex_1()
            .min_w_0()
            .min_h_0()
            .flex()
            .flex_col()
            .bg(rgb(PAPER))
            .child(
                div()
                    .flex()
                    .flex_wrap()
                    .gap_1()
                    .px_3()
                    .py_2()
                    .border_b_1()
                    .border_color(rgb(BORDER))
                    .children(destinations.iter().map(|&(folder, label, image)| {
                        control(label)
                            .gap_1()
                            .child(icon(image, MUTED, 15.))
                            .child(label)
                            .on_click(cx.listener(move |this, _, window, cx| {
                                this.messages[id].folder = folder;
                                this.selected = None;
                                this.focus.focus(window);
                                cx.notify();
                            }))
                    }))
                    .child(
                        control("mark-read")
                            .child(if message.unread {
                                "Mark read"
                            } else {
                                "Mark unread"
                            })
                            .on_click(cx.listener(move |this, _, _, cx| {
                                this.messages[id].unread = !this.messages[id].unread;
                                cx.notify();
                            })),
                    ),
            )
            .child(
                div()
                    .id("message-reader")
                    .flex_1()
                    .min_h_0()
                    .overflow_y_scroll()
                    .child(
                        div()
                            .flex()
                            .flex_col()
                            .px_7()
                            .py_6()
                            .child(
                                div()
                                    .text_size(px(24.))
                                    .line_height(px(30.))
                                    .font_weight(FontWeight::SEMIBOLD)
                                    .child(message.subject),
                            )
                            .child(
                                div()
                                    .flex()
                                    .items_center()
                                    .gap_3()
                                    .mt_5()
                                    .pb_5()
                                    .border_b_1()
                                    .border_color(rgb(BORDER))
                                    .child(
                                        div()
                                            .flex()
                                            .items_center()
                                            .justify_center()
                                            .size(px(37.))
                                            .rounded_full()
                                            .flex_shrink_0()
                                            .font_weight(FontWeight::SEMIBOLD)
                                            .text_xs()
                                            .bg(rgb(background))
                                            .text_color(rgb(foreground))
                                            .child(initials),
                                    )
                                    .child(
                                        div()
                                            .flex_1()
                                            .min_w_0()
                                            .child(
                                                div()
                                                    .truncate()
                                                    .font_weight(FontWeight::SEMIBOLD)
                                                    .child(message.sender),
                                            )
                                            .child(
                                                div()
                                                    .truncate()
                                                    .text_xs()
                                                    .text_color(rgb(MUTED))
                                                    .child(message.email),
                                            ),
                                    )
                                    .child(
                                        div()
                                            .flex_shrink_0()
                                            .text_xs()
                                            .text_color(rgb(MUTED))
                                            .child(message.date),
                                    ),
                            )
                            .child(
                                div()
                                    .mt_5()
                                    .max_w(px(590.))
                                    .line_height(px(23.))
                                    .child(message.body),
                            ),
                    ),
            )
    }
}

fn icon(path: &'static str, color: u32, size: f32) -> impl IntoElement {
    svg()
        .path(path)
        .size(px(size))
        .text_color(rgb(color))
        .flex_shrink_0()
}

fn control(id: &'static str) -> Stateful<Div> {
    div()
        .id(id)
        .debug_selector(|| id.into())
        .flex()
        .items_center()
        .h(px(31.))
        .rounded_md()
        .px_2()
        .text_xs()
        .cursor_pointer()
        .hover(|button| button.bg(rgb(HOVER)))
}

impl Render for Mail {
    fn render(&mut self, _: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
        let ids = self.ids_in_view(cx);
        div()
            .flex()
            .size_full()
            .overflow_hidden()
            .text_size(px(14.))
            .bg(rgb(PAPER))
            .text_color(rgb(INK))
            .font_family(SharedString::from("Segoe UI"))
            .track_focus(&self.focus)
            .key_context("Mail")
            .on_action(cx.listener(|this, _: &FocusSearch, window, cx| {
                this.search
                    .update(cx, |search, cx| search.focus(window, cx));
            }))
            .on_action(cx.listener(|this, _: &NextMessage, window, cx| {
                if this.focus.is_focused(window) {
                    this.step_selection(1, cx);
                }
            }))
            .on_action(cx.listener(|this, _: &PreviousMessage, window, cx| {
                if this.focus.is_focused(window) {
                    this.step_selection(-1, cx);
                }
            }))
            .on_action(cx.listener(|this, _: &ReturnToList, window, _| this.focus.focus(window)))
            .child(self.render_sidebar(cx))
            .child(self.render_list(ids, cx))
            .child(self.render_reader(cx))
    }
}

fn configure_mail(cx: &mut App) {
    gpui_component::init(cx);
    Theme::change(ThemeMode::Light, None, cx);
    cx.bind_keys([
        KeyBinding::new("ctrl-f", FocusSearch, Some("Mail")),
        KeyBinding::new("down", NextMessage, Some("Mail")),
        KeyBinding::new("up", PreviousMessage, Some("Mail")),
        KeyBinding::new("escape", ReturnToList, Some("Mail")),
    ]);
}

fn main() {
    let empty = std::env::args().any(|arg| arg == "--empty");
    Application::new()
        .with_assets(icons::MailIcons)
        .run(move |cx: &mut App| {
            configure_mail(cx);
            cx.on_window_closed(|cx| {
                if cx.windows().is_empty() {
                    cx.quit();
                }
            })
            .detach();
            let bounds = Bounds::centered(None, size(px(1220.), px(768.)), cx);
            cx.open_window(
                WindowOptions {
                    window_bounds: Some(WindowBounds::Windowed(bounds)),
                    window_min_size: Some(size(px(940.), px(600.))),
                    ..Default::default()
                },
                move |window, cx| {
                    window.set_window_title("Mail Preview · Rust / GPUI");
                    let mail = cx.new(|cx| Mail::new(empty, window, cx));
                    cx.new(|cx| Root::new(mail, window, cx))
                },
            )
            .expect("Could not open Mail Preview");
            cx.activate(true);
        });
}
