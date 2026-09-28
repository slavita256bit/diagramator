package library;

import java.util.ArrayList;
import java.util.List;

public class Library {
    private final List<Shelf> shelves = new ArrayList<>();
    private final List<Member> members = new ArrayList<>();

    public Member register(String cardId) {
        Member m = new Member(cardId);
        members.add(m);
        return m;
    }

    public List<Item> search(String query) { return new ArrayList<>(); }
}
