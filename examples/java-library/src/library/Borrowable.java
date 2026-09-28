package library;

/** Interface: anything a member can borrow. */
public interface Borrowable {
    boolean isAvailable();
    void checkOut(Member member);
}
