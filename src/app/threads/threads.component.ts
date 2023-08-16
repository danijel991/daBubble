import { Component, OnChanges, OnInit, SimpleChanges } from '@angular/core';
import { Observable, Subscription } from "rxjs";
import { ChannelDataInterface, ChannelDataService } from "../service-moduls/channel.service";
import { UserDataInterface, UserDataService } from "../service-moduls/user.service";
import { ChatDataInterface, ChatDataService } from "../service-moduls/chat.service";
import { MessageDataInterface, MessageDataService } from "../service-moduls/message.service";
import { DirectMessageService, DirectMessageInterface } from '../service-moduls/direct-message.service';
import { map } from "rxjs/operators";
import { ChannelDataResolverService } from "../service-moduls/channel-data-resolver.service";
import { ChatBehaviorService } from "../service-moduls/chat-behavior.service";
import { FormBuilder, FormControl, FormGroup, Validators } from "@angular/forms";
import { ThreadDataInterface, ThreadDataService } from "../service-moduls/thread.service";
import { collection, doc, Firestore, getDoc, updateDoc } from "@angular/fire/firestore";

@Component({
  selector: 'app-threads',
  templateUrl: './threads.component.html',
  styleUrls: ['./threads.component.scss']
})
export class ThreadsComponent implements OnInit, OnChanges {
  private threadUpdateSubscription: Subscription = new Subscription();

  typedEmoji: string = '';
  reactionEmojis = ['👍', '😂', '🚀', '❤️', '😮', '🎉'];
  emojisClickedBefore: number | undefined;

  [x: string]: any;
  channelName!: FormGroup;
  channelDescription!: FormGroup;

  receivedChannelData$!: Observable<ChannelDataInterface | null>;

  userData: UserDataInterface[] = [];
  messageData: MessageDataInterface[] = [];
  channelData: ChannelDataInterface[] = [];
  threadData: ThreadDataInterface[] = [];

  /// new multiple selection option for mention users
  mentionUser = new FormControl('');
  userList: string[] = [];

  selectedMessage: MessageDataInterface | null = null;
  currentChannelData: ChannelDataInterface | null = null;

  channelId: string = "";
  directChat: string = "";
  updateChatByChannelId: string = "";
  updateDirectChatId: string = "";

  messageInput: string[] = [];
  messageId: string = '';
  sentByName: string[] = [];
  usersFromUserData: string[] = [];
  isProfileCardOpen: boolean = false;
  isLogoutContainerOpen: boolean = false;
  currentUser: string = '';
  currentUserId: string = '';

  deleteUserFormChannel: any;

  editChannelName: boolean = false;
  editChannelDescription: boolean = false;
  openEditChannel: boolean = false;
  emojipickeractive = false;
  reactionListOpen = false;
  toggleUserList: boolean = true;

  /*  private crudTriggeredSubscription: Subscription; */
  triggerCRUDHTML: boolean = true;
  loading: boolean = false;

  inviteUserOrChannel!: string;
  searchResults: UserDataInterface[] = [];


  constructor(
    private messageDataService: MessageDataService,
    private directMessageService: DirectMessageService,
    public userDataService: UserDataService,
    private channelDataService: ChannelDataService,
    private chatDataService: ChatDataService,
    private fbChannelName: FormBuilder,
    private fbChannelDescription: FormBuilder,
    private threadDataService: ThreadDataService,
    private firestore: Firestore,
  ) {
    /*  this.crudTriggeredSubscription = this.chatBehavior.crudTriggered$.subscribe(() => {
       this.performCRUD();
     }); */
  }

  ngOnChanges(changes: SimpleChanges): void {
    console.log('changes here', this.sentByName)
  }

  ngOnInit(): void {
    this.channelName = this.fbChannelName.group({
      channelName: ['', [Validators.required]],
    });
    this.channelDescription = this.fbChannelDescription.group({
      channelDescription: ['', [Validators.required]],
    });
    this.getCurrentUserId();
    this.getDirectChatData();
    /*  this.getMessageData();
        this.getDataFromChannel();
     this.getUserData();
     this.getDirectChatData();
     this.compareIds();
     this.deleteUserFromChannel();
     this.getThreadData(); */
    this.startThread();

  }

  async startThread() {
    this.threadUpdateSubscription = this.threadDataService.threadUpdate$.subscribe(async () => {
      await this.renderChatByThreadId();
      await this.renderDirectChatByThreadId();
    });
  }

  ngOnDestroy() {
    /* this.crudTriggeredSubscription.unsubscribe(); */
    this.threadUpdateSubscription.unsubscribe();
  }

  async renderChatByThreadId() {
    if (this.threadDataService.threadId) {
      this.threadDataService.getThreadDataMessages().subscribe(
        (threadData: ThreadDataInterface[]) => {
          const messagesForChannel = threadData.filter(message => message.thread === this.threadDataService.threadId);
          if (messagesForChannel.length > 0) {
            const filteredData = messagesForChannel.filter((message) => message.time !== undefined && message.time !== null);
            const sortDataAfterTime = filteredData.sort((a, b) => a.time! > b.time! ? 1 : -1);
            console.log('Messages to Render in Thread:', sortDataAfterTime);
            this.threadData = sortDataAfterTime;
            this.getChannelData();
          } else {
            console.log('No messages found in Thread:', this.threadDataService.threadId);
            this.threadData = [];
          }
        },
        (error) => {
          console.error('ERROR render messages in Thread:', error);
        }
      );
    } 
  }

  async renderDirectChatByThreadId() {
    if (this.threadDataService.threadId) {
      this.threadDataService.getThreadDataDirectMessages().subscribe(
        (threadData: ThreadDataInterface[]) => {
          const messagesDirect = threadData.filter(message => message.thread === this.threadDataService.threadId);
          if (messagesDirect.length > 0) {
            const filteredData = messagesDirect.filter((message) => message.time !== undefined && message.time !== null);
            const sortDataAfterTime = filteredData.sort((a, b) => a.time! > b.time! ? 1 : -1);
            console.log('Messages to Render in Thread:', sortDataAfterTime);
            this.threadData = sortDataAfterTime;
            this.getDirectChatData();
          } else {
            console.log('No messages found in Thread:', this.threadDataService.threadId);
            this.threadData = [];
          }
        }, (error) => {
          console.error('ERROR render messages in Thread:', error);
        }
      )
    } else {
      this.threadData = [];
    }
  }

  async getChannelData() {
    if (this.threadData[0]?.channel) {
      this.processChannelData(this.threadData[0].channel);
      console.log(this.threadData[0].channel);
    } else {
      console.log("No channel in threadData[0]");
    }
  }
  
  async getDirectChatData() {
    if (this.threadData[0]?.directMessage) {
      this.processDirectChatData(this.threadData[0].directMessage);
      console.log(this.threadData[0].directMessage);
    } else {
      console.log("No directMessage in threadData[0]");
    }
  }

  processChannelData(channelId: string) {
    this.channelId = channelId;
    this.updateChatByChannelId = channelId;
    this.renderChatByChannelId(this.updateChatByChannelId);
  }

  processDirectChatData(chatId: string) {
    this.directChat = chatId
    this.updateDirectChatId = chatId;
    this.renderChatByDirectChatId(this.updateDirectChatId);
  }

  renderChatByChannelId(channel: string) {
    if (channel) {
      console.log(channel);
      this.channelDataService.getChannelData().subscribe(
        (channelData: ChannelDataInterface[]) => {
          const filterChannel = channelData.filter((channelItem) => channelItem.id === channel);
          this.channelData = filterChannel;
          this.loading = true;
          console.log("The filterd channel id in THREAD", this.channelData);
        },
        (error) => {
          console.error('Error THREAD chat data:', error);
        }
      );
    } else {
      this.channelData = [];
    }
  }

  renderChatByDirectChatId(directMessage: string) {
    if (directMessage) {
      console.log(directMessage);
      this.directMessageService.getDirectMessageData().subscribe(
        (directMessageData: DirectMessageInterface[]) => {
          const filterdirectMessage = directMessageData.filter((directMessage) => directMessage.id === directMessage);
          this['directMessageData'] = filterdirectMessage;
          this.loading = true;
          console.log("The filterd channel id in THREAD", this['directMessageData']);
        },
        (error) => {
          console.error('Error THREAD chat data:', error);
        }
      );
    } else {
      this.channelData = [];
    }
  }

  getCurrentUserId() {
    this.currentUserId = this.userDataService.currentUser;
  }

  async deleteUserFromChannel() {
    await this.userDataService.getCurrentUserData(this.userDataService.currentUser);
    this.deleteUserFormChannel = this.userDataService.currentUser;
  }

  async leaveChannel() {
    if (this.deleteUserFormChannel && this.currentChannelData) {
      console.log("Im logged in", this.deleteUserFormChannel);
      try {
        const matchingChannel = this.currentChannelData.id;
        console.log(matchingChannel);
        if (matchingChannel) {
          const channelCollection = collection(this.firestore, 'channels');
          const channelDoc = doc(channelCollection, matchingChannel);
          const channelDocSnapshot = await getDoc(channelDoc);

          if (channelDocSnapshot.exists()) {
            const usersArray = channelDocSnapshot.data()['users'] || [];
            const updatedUsersArray = usersArray.filter((user: any) => user !== this.deleteUserFormChannel);
            await updateDoc(channelDoc, {
              users: updatedUsersArray
            });
            console.log("User removed from the channel.");
          } else {
            console.log("Matching channel not found.");
          }
        }
      } catch (error) {
        console.error('Error removing user:', error);
      }
    }
  }

  public typeEmoji($event: any): void {
    this.messageInput = this.messageInput + $event.character;
  }

  isNewDay(
    currentMessage: MessageDataInterface,
    previousMessage: MessageDataInterface
  ): boolean {
    if (!previousMessage) {
      return true;
    }

    const currentDate = new Date(currentMessage.time!);
    const previousDate = new Date(previousMessage.time!);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);

    return (
      currentDate.getFullYear() !== previousDate.getFullYear() ||
      currentDate.getMonth() !== previousDate.getMonth() ||
      currentDate.getDate() !== previousDate.getDate() ||
      currentDate.getTime() === today.getTime() ||
      currentDate.getTime() === yesterday.getTime()
    );
  }

  async sendMessage() {
    if (this.messageInput.length > 0) {
      const message: MessageDataInterface = {
        messageText: this.messageInput,
        sentById: this.currentUserId,
        time: Date.now(),
        emojis: [],
        thread: this.threadDataService.threadId,
        channel: 'Thread Message',
        mentionedUser: 'user_id_here',
      };

      if (this.emojipickeractive) {
        this.toggleEmojiPicker();
      }

      this.messageData.push(message);
      this.messageInput = [''];

      this.messageDataService.sendMessage(message).subscribe(
        (newMessage) => {
          if (newMessage && newMessage.id) {
            const index = this.messageData.findIndex((msg) => msg === message);
            if (index !== -1) {
              this.messageData[index].id = newMessage.id;
            }
          }
        },
        (error) => {
          console.error('Error sending message:', error);
        }
      );
      this.chatDataService.addMessageToChat(message).subscribe();
    } else {
      console.log('Message input is empty. Cannot send an empty message.');
    }
  }

  // *** EMOJI REACTION ***
  reaction(messageEmoji: string, index: number) {
    if (this.emojisClickedBefore === index) {
      document
        .getElementById(`reaction${this.emojisClickedBefore}`)
        ?.classList.remove('showEmojis');
      this.emojisClickedBefore = undefined;
    } else {
      if (this.emojisClickedBefore !== null) {
        document
          .getElementById(`reaction${this.emojisClickedBefore}`)
          ?.classList.remove('showEmojis');
      }
      document.getElementById(`reaction${index}`)?.classList.add('showEmojis');
      this.emojisClickedBefore = index;
    }
  }

  reactWithEmoji(emoji: string, index: number, messageId: string) {
    let emojiArray = this.messageData[index].emojis;
    if (this.existReaction(index)) {
      let indexWithCurrentUser = emojiArray.findIndex((reaction: { [x: string]: string; }) => reaction['reaction-from'] === this.currentUser);
      emojiArray[indexWithCurrentUser] = { 'emoji': emoji, 'reaction-from': this.currentUser };
    } else {
      emojiArray.push({ 'emoji': emoji, 'reaction-from': this.currentUser });
    }
    this.messageDataService.updateMessage(messageId, emojiArray);
    this.emojisClickedBefore = undefined;
    this.reactionListOpen = false;
  }


  existReaction(index: number): boolean {
    return this.messageData[index].emojis.some((reaction: { [x: string]: string; }) => {
      return reaction['reaction-from'] === this.currentUser;
    });
  }

  showReaction(index: number) {
    let item = document.getElementById(`reactionlist${index}`);
    this.messageData.forEach((message, i) => {
      let hideItems = document.getElementById(`reactionlist${i}`);
      hideItems?.classList.remove('show-list-of-reactions');
    });
    if (!this.reactionListOpen) {
      item?.classList.add('show-list-of-reactions');
      this.reactionListOpen = true;
    } else {
      this.reactionListOpen = false;
    }
  }

  toggleEmojiPicker() {
    this.emojipickeractive = !this.emojipickeractive;
  }

  editChannel() {
    this.openEditChannel = true;
    this.receivedChannelData$.subscribe((data: ChannelDataInterface | null) => {
      if (data) {
        this.currentChannelData = data;
      }
      console.log('Received Channel Data:', this.currentChannelData);
    });
  }

  openUserProfile(id: any) {
    this.isProfileCardOpen = true;
    this.isLogoutContainerOpen = false;
    this.userDataService.getCurrentUserData(id);
  }

  closeUserProfile() {
    this.isProfileCardOpen = false;
  }

  closeEditChannel() {
    this.openEditChannel = false;
  }

  updateChannelName() {
    this.editChannelName = true;
  }

  updateChannelDiscription() {
    this.editChannelDescription = true;
  }

  saveChangesToChannelName() {
    if (this.channelName.valid && this.currentChannelData) {
      console.log('Saving changes to channel', this.currentChannelData);
      const newChannelName: string = this.channelName.value.channelName;

      this.currentChannelData.channelName = newChannelName;
      this.channelDataService
        .sendChannelData(this.currentChannelData)
        .subscribe(
          () => {
            console.log('Channel name updated successfully.');
          },
          (error) => {
            console.error('Error updating channel name:', error);
          }
        );
      this.channelName.reset();
      this.editChannelName = false;
    }
  }

  saveChangesToChannelDescription() {
    if (this.channelDescription.valid && this.currentChannelData) {
      const newChannelDescription: string = this.channelDescription.value.channelDescription;
      this.currentChannelData.channelDescription = newChannelDescription;
      this.channelDataService.sendChannelData(this.currentChannelData).subscribe(
        () => {
          console.log('Channel description updated successfully.');
        },
        (error) => {
          console.error('Error updating channel name:', error);
        }
      );
      this.channelDescription.reset();
      this.editChannelDescription = false;
    }
  }

  formatTimeStamp(time: number | undefined): string {
    if (typeof time === 'undefined') {
      return 'N/A';
    }

    const dateObj = new Date(time);
    const hours = dateObj.getHours();
    const minutes = dateObj.getMinutes();
    const formattedHours = hours.toString().padStart(2, '0');
    const formattedMinutes = minutes.toString().padStart(2, '0');
    const amOrPm = hours >= 12 ? 'pm' : 'am';

    return `${formattedHours}:${formattedMinutes} ${amOrPm}`;
  }

  getFormattedDate(time: number | undefined): string {
    if (typeof time === 'undefined') {
      return '';
    }

    const currentDate = new Date();
    currentDate.setHours(0, 0, 0, 0); // Set time to 00:00:00

    const messageDate = new Date(time);
    messageDate.setHours(0, 0, 0, 0); // Set time to 00:00:00

    if (messageDate.getTime() === currentDate.getTime()) {
      return 'Today';
    }

    const yesterday = new Date(currentDate);
    yesterday.setDate(currentDate.getDate() - 1);

    if (messageDate.getTime() === yesterday.getTime()) {
      return 'Yesterday';
    }

    return messageDate.toLocaleDateString('en-US', {
      year: 'numeric', // Change to 'numeric' to display all four digits of the year
      month: 'long',
      day: 'numeric',
    });
  }


  async compareIds() {
    this.messageDataService.messageData$.subscribe(
      (messages) => {

        this.userDataService.getUserData().pipe(
          map((userData) => userData.map(user => user.id))
        ).subscribe(
          (userIds: string[]) => {

            const userIdToNameMap: { [id: string]: string } = {};
            this.userData.forEach(user => {
              if (userIds.includes(user.id)) {
                userIdToNameMap[user.id] = user.name;
              }
            });
            const matches: string[] = [];
            messages.forEach((message) => {
              if (this.currentUserId && userIdToNameMap.hasOwnProperty(this.currentUserId)) {
                const senderName = userIdToNameMap[this.currentUserId];
                matches.push(this.currentUserId);
                this.currentUser = senderName;
              }
            });
          }
        );
      }
    );
  }

  async deleteMessage(messageId: any) {
    if (!messageId) {
      return;
    }
    try {
      await this.messageDataService.deleteMessage(messageId);
      this.messageData = this.messageData.filter(message => message.id !== messageId);
    } catch (error) {
      console.error('Error deleting message:', error);
    }
  }

  close() {
    this.loading = false;
    this.threadDataService.threadOpen = false;
  }
}
