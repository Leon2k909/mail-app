#[derive(Clone, Copy, PartialEq, Eq)]
pub enum Folder {
    Inbox,
    Drafts,
    Sent,
    Junk,
    Trash,
    Archive,
}

impl Folder {
    pub const ALL: [Self; 6] = [
        Self::Inbox,
        Self::Drafts,
        Self::Sent,
        Self::Junk,
        Self::Trash,
        Self::Archive,
    ];

    pub fn title(self) -> &'static str {
        match self {
            Self::Inbox => "Inbox",
            Self::Drafts => "Drafts",
            Self::Sent => "Sent",
            Self::Junk => "Junk",
            Self::Trash => "Trash",
            Self::Archive => "Archive",
        }
    }

    pub fn icon(self) -> &'static str {
        match self {
            Self::Inbox => "inbox",
            Self::Drafts => "file",
            Self::Sent => "send",
            Self::Junk => "shield",
            Self::Trash => "trash",
            Self::Archive => "archive",
        }
    }
}

pub struct Message {
    pub sender: &'static str,
    pub email: &'static str,
    pub subject: &'static str,
    pub preview: &'static str,
    pub date: &'static str,
    pub avatar: (&'static str, u32, u32),
    pub body: &'static str,
    pub folder: Folder,
    pub unread: bool,
}

impl Message {
    pub fn matches(&self, query: &str) -> bool {
        query.is_empty()
            || [self.sender, self.email, self.subject, self.body]
                .iter()
                .any(|text| text.to_lowercase().contains(query))
    }
}

pub fn samples() -> Vec<Message> {
    use Folder::*;

    vec![
        Message {
            sender: "Maya Chen",
            email: "maya@example.com",
            subject: "Proofs for the autumn collection",
            preview: "The updated proofs are ready to review. Could you check the front cover?",
            date: "Today, 10:42",
            avatar: ("MC", 0xe5ecfa, 0x294776),
            folder: Inbox,
            unread: false,
            body: "Hi,\n\nThe updated proofs are ready to review. Could you check the front cover and the two product pages we changed last week?\n\nI’ve kept the original crop on the cover and lightened the background on page four. The team is happy with the print test, so those are the only pages I need a second pair of eyes on.\n\nIf you can send notes by Tuesday afternoon, I’ll be able to get the final files to the printer the same day.\n\nThanks,\nMaya",
        },
        Message {
            sender: "Owen Patel",
            email: "owen@example.com",
            subject: "Stock count for Monday",
            preview: "I’ve finished checking the delivery that came in yesterday.",
            date: "Today, 09:18",
            avatar: ("OP", 0xe5efe9, 0x315747),
            folder: Inbox,
            unread: true,
            body: "Morning,\n\nI’ve finished checking the delivery that came in yesterday. The counts match the order, apart from two small boxes that are arriving separately on Monday.\n\nI’ve set aside the sample units on the shelves by the door. Let me know if you’d like me to label those before we open.\n\nOwen",
        },
        Message {
            sender: "Northline Studio",
            email: "studio@example.com",
            subject: "Photography shortlist",
            preview: "We’ve narrowed the shoot down to twelve images for the first pass.",
            date: "Yesterday",
            avatar: ("NS", 0xf3e9dd, 0x624a31),
            folder: Inbox,
            unread: true,
            body: "Hello,\n\nWe’ve narrowed the shoot down to twelve images for the first pass. The two wide shots and the detail photo by the window are our favourites.\n\nOnce you’ve picked the images you want to use, we’ll send print and web versions in a single folder.\n\nNorthline Studio",
        },
        Message {
            sender: "Sam Rivera",
            email: "sam@example.com",
            subject: "Notes from the site visit",
            preview: "Here’s what we agreed with the team on Thursday.",
            date: "Yesterday",
            avatar: ("SR", 0xeee8f3, 0x5b4670),
            folder: Inbox,
            unread: false,
            body: "Hi,\n\nHere’s what we agreed with the team on Thursday. The entrance stays where it is, and we’ll move the two displays closer to the front window. The revised drawing is due next week.\n\nI’ll contact the electrician separately about the power points.\n\nSam",
        },
        Message {
            sender: "Ellie Morris",
            email: "ellie@example.com",
            subject: "Tuesday delivery window",
            preview: "The courier has confirmed they can unload between 08:00 and 10:00.",
            date: "Thu, 19 Nov",
            avatar: ("EM", 0xf3e8e6, 0x6c443d),
            folder: Inbox,
            unread: true,
            body: "Hi,\n\nThe courier has confirmed they can unload between 08:00 and 10:00. The driver will call when they’re half an hour away.\n\nIf you’re working from home that morning, I can meet them at the entrance.\n\nEllie",
        },
        Message {
            sender: "Avery Brooks",
            email: "avery@example.com",
            subject: "Booking confirmation",
            preview: "The meeting room is booked for Thursday at half past two.",
            date: "Wed, 18 Nov",
            avatar: ("AB", 0xe5ecfa, 0x294776),
            folder: Inbox,
            unread: false,
            body: "Hi,\n\nThe meeting room is booked for Thursday at half past two. There’s a screen in the room, so feel free to bring your laptop.\n\nAvery",
        },
        Message {
            sender: "Fieldwork Print",
            email: "orders@example.com",
            subject: "October invoice",
            preview: "Your invoice covers both print runs and the courier charge.",
            date: "Tue, 17 Nov",
            avatar: ("FP", 0xf3e9dd, 0x624a31),
            folder: Inbox,
            unread: false,
            body: "Hello,\n\nYour invoice covers both print runs and the courier charge. Please quote the order number if you have any questions.\n\nThank you,\nFieldwork Print",
        },
        Message {
            sender: "Jamie Ellis",
            email: "jamie@example.com",
            subject: "Updated opening hours",
            preview: "I’ve shared the new hours with the front desk and the website team.",
            date: "Mon, 16 Nov",
            avatar: ("JE", 0xe5efe9, 0x315747),
            folder: Inbox,
            unread: false,
            body: "Hi,\n\nI’ve shared the new hours with the front desk and the website team. The updated signs are going up on Monday morning.\n\nJamie",
        },
        Message {
            sender: "You",
            email: "preview@example.com",
            subject: "Re: Photography shortlist",
            preview: "Thanks for the first pass. I’ll go through it this afternoon.",
            date: "Yesterday",
            avatar: ("ME", 0xe5ecfa, 0x294776),
            folder: Drafts,
            unread: false,
            body: "Thanks for the first pass. I’ll go through it this afternoon and send you our selection.",
        },
        Message {
            sender: "You",
            email: "preview@example.com",
            subject: "November handover",
            preview: "I’ve put the outstanding orders and delivery contacts in the shared folder.",
            date: "Thu, 19 Nov",
            avatar: ("ME", 0xe5ecfa, 0x294776),
            folder: Sent,
            unread: false,
            body: "Hi,\n\nI’ve put the outstanding orders and delivery contacts in the shared folder. Everything arriving this week has a date next to it.\n\nThanks!",
        },
        Message {
            sender: "Warehouse Team",
            email: "warehouse@example.com",
            subject: "October stock summary",
            preview: "The stock count for October is complete and ready to file.",
            date: "Mon, 2 Nov",
            avatar: ("WT", 0xe5efe9, 0x315747),
            folder: Archive,
            unread: false,
            body: "Hello,\n\nThe stock count for October is complete and ready to file. Our review found no discrepancies.\n\nWarehouse Team",
        },
    ]
}
